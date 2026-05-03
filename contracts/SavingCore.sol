// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVaultManager {
    function payInterest(address to, uint256 amount) external;
    function feeReceiver() external view returns (address);
    function paused() external view returns (bool);
}

contract SavingCore is ERC721, Ownable, Pausable, ReentrancyGuard {
    enum DepositStatus { Active, Withdrawn, ManualRenewed, AutoRenewed }

    struct SavingPlan {
        uint256 minAmount;
        uint256 maxAmount;
        uint256 tenorDays;
        uint256 aprBps;
        uint256 penaltyBps;
        bool enabled;
    }

    struct DepositCertificate {
        uint256 planId;
        uint256 principal;
        uint256 tenorDays;
        uint256 aprBpsAtOpen;
        uint256 penaltyBpsAtOpen;
        uint256 startAt;
        uint256 maturityAt;
        DepositStatus status;
    }

    uint256 private _planCounter;
    uint256 private _depositCounter;
    IERC20 public immutable paymentToken;
    IVaultManager public vaultManager;

    mapping(uint256 => SavingPlan) public plans;
    mapping(uint256 => DepositCertificate) public deposits;

    event PlanCreated(uint256 indexed planId, uint256 minAmount, uint256 maxAmount, uint256 tenorDays, uint256 aprBps, uint256 penaltyBps);
    event PlanUpdated(uint256 indexed planId, bool enabled);
    event DepositOpened(uint256 indexed depositId, address indexed user, uint256 planId, uint256 amount);
    event WithdrawnAtMaturity(uint256 indexed depositId, address indexed user, uint256 principal, uint256 interest);
    event EarlyWithdrawn(uint256 indexed depositId, address indexed user, uint256 principal, uint256 penalty);
    event Renewed(address indexed user, uint256 oldDepositId, uint256 newDepositId, uint256 newPrincipal);
    event AutoRenewed(address indexed user, uint256 oldDepositId, uint256 newDepositId, uint256 newPrincipal);

    constructor(address _paymentToken, address _vaultManager) 
        ERC721("DepositCertificate", "DC") 
        Ownable(msg.sender) 
    {
        paymentToken = IERC20(_paymentToken);
        vaultManager = IVaultManager(_vaultManager);
        _planCounter = 0;
        _depositCounter = 0;
    }

    function createPlan(
        uint256 minAmount,
        uint256 maxAmount,
        uint256 tenorDays,
        uint256 aprBps,
        uint256 penaltyBps
    ) external onlyOwner {
        require(tenorDays > 0, "Tenor must be positive");
        require(aprBps <= 10000, "APR cannot exceed 100%");
        require(penaltyBps <= 10000, "Penalty cannot exceed 100%");
        require(maxAmount > minAmount, "Max must exceed min");

        uint256 planId = _planCounter;
        plans[planId] = SavingPlan({
            minAmount: minAmount,
            maxAmount: maxAmount,
            tenorDays: tenorDays,
            aprBps: aprBps,
            penaltyBps: penaltyBps,
            enabled: true
        });
        _planCounter++;
        emit PlanCreated(planId, minAmount, maxAmount, tenorDays, aprBps, penaltyBps);
    }

    function updatePlan(uint256 planId, bool enabled) external onlyOwner {
        require(plans[planId].tenorDays > 0, "Plan does not exist");
        plans[planId].enabled = enabled;
        emit PlanUpdated(planId, enabled);
    }

    function openDeposit(uint256 planId, uint256 amount) external nonReentrant whenNotPaused {
        SavingPlan memory plan = plans[planId];
        require(plan.enabled, "Plan not enabled");
        require(amount >= plan.minAmount, "Below minimum");
        require(amount <= plan.maxAmount, "Above maximum");

        paymentToken.transferFrom(msg.sender, address(this), amount);

        uint256 depositId = _depositCounter;
        _depositCounter++;

        uint256 maturityAt = block.timestamp + plan.tenorDays * 86400;

        deposits[depositId] = DepositCertificate({
            planId: planId,
            principal: amount,
            tenorDays: plan.tenorDays,
            aprBpsAtOpen: plan.aprBps,
            penaltyBpsAtOpen: plan.penaltyBps,
            startAt: block.timestamp,
            maturityAt: maturityAt,
            status: DepositStatus.Active
        });

        _safeMint(msg.sender, depositId);
        emit DepositOpened(depositId, msg.sender, planId, amount);
    }

    function withdrawAtMaturity(uint256 depositId) external nonReentrant whenNotPaused {
        DepositCertificate storage deposit = deposits[depositId];
        require(ownerOf(depositId) == msg.sender, "Not owner");
        require(deposit.status == DepositStatus.Active, "Not active");
        require(block.timestamp >= deposit.maturityAt, "Too early");

        uint256 interest = _calculateInterest(deposit.principal, deposit.aprBpsAtOpen, deposit.tenorDays);

        deposit.status = DepositStatus.Withdrawn;
        
        vaultManager.payInterest(msg.sender, interest);
        paymentToken.transfer(msg.sender, deposit.principal);

        emit WithdrawnAtMaturity(depositId, msg.sender, deposit.principal, interest);
    }

    function earlyWithdraw(uint256 depositId) external nonReentrant whenNotPaused {
        DepositCertificate storage deposit = deposits[depositId];
        require(ownerOf(depositId) == msg.sender, "Not owner");
        require(deposit.status == DepositStatus.Active, "Not active");

        uint256 penalty = (deposit.principal * deposit.penaltyBpsAtOpen) / 10000;
        uint256 netPrincipal = deposit.principal - penalty;

        deposit.status = DepositStatus.Withdrawn;
        
        paymentToken.transfer(msg.sender, netPrincipal);
        paymentToken.transfer(vaultManager.feeReceiver(), penalty);

        emit EarlyWithdrawn(depositId, msg.sender, deposit.principal, penalty);
    }

    function renewDeposit(uint256 depositId, uint256 newPlanId) external nonReentrant whenNotPaused {
        DepositCertificate storage deposit = deposits[depositId];
        require(ownerOf(depositId) == msg.sender, "Not owner");
        require(deposit.status == DepositStatus.Active, "Not active");
        require(block.timestamp >= deposit.maturityAt, "Too early");

        SavingPlan memory newPlan = plans[newPlanId];
        require(newPlan.enabled, "Plan not enabled");

        uint256 interest = _calculateInterest(deposit.principal, deposit.aprBpsAtOpen, deposit.tenorDays);
        uint256 newPrincipal = deposit.principal + interest;

        require(newPrincipal >= newPlan.minAmount, "New principal below min");
        require(newPrincipal <= newPlan.maxAmount, "New principal above max");

        deposit.status = DepositStatus.ManualRenewed;

        uint256 newDepositId = _depositCounter;
        _depositCounter++;

        deposits[newDepositId] = DepositCertificate({
            planId: newPlanId,
            principal: newPrincipal,
            tenorDays: newPlan.tenorDays,
            aprBpsAtOpen: newPlan.aprBps,
            penaltyBpsAtOpen: newPlan.penaltyBps,
            startAt: block.timestamp,
            maturityAt: block.timestamp + newPlan.tenorDays * 86400,
            status: DepositStatus.Active
        });

        _safeMint(msg.sender, newDepositId);
        emit Renewed(msg.sender, depositId, newDepositId, newPrincipal);
    }

    function autoRenewDeposit(uint256 depositId) external nonReentrant whenNotPaused {
        DepositCertificate storage deposit = deposits[depositId];
        require(deposit.status == DepositStatus.Active, "Not active");
        require(block.timestamp >= deposit.maturityAt + 3 days, "Within grace period");

        uint256 interest = _calculateInterest(deposit.principal, deposit.aprBpsAtOpen, deposit.tenorDays);
        uint256 newPrincipal = deposit.principal + interest;

        deposit.status = DepositStatus.AutoRenewed;

        uint256 newDepositId = _depositCounter;
        _depositCounter++;

        deposits[newDepositId] = DepositCertificate({
            planId: deposit.planId,
            principal: newPrincipal,
            tenorDays: deposit.tenorDays,
            aprBpsAtOpen: deposit.aprBpsAtOpen,
            penaltyBpsAtOpen: deposit.penaltyBpsAtOpen,
            startAt: block.timestamp,
            maturityAt: block.timestamp + deposit.tenorDays * 86400,
            status: DepositStatus.Active
        });

        _safeMint(ownerOf(depositId), newDepositId);
        emit AutoRenewed(ownerOf(depositId), depositId, newDepositId, newPrincipal);
    }

    function getDeposit(uint256 depositId) external view returns (DepositCertificate memory) {
        return deposits[depositId];
    }

    function getPlan(uint256 planId) external view returns (SavingPlan memory) {
        return plans[planId];
    }

    function _calculateInterest(uint256 principal, uint256 aprBps, uint256 tenorDays) internal pure returns (uint256) {
        return (principal * aprBps * tenorDays) / 365 / 10000;
    }
}