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

    // Required Events (Section 5)
    event PlanCreated(uint256 planId, uint256 tenorDays, uint256 aprBps);
    event PlanUpdated(uint256 planId, uint256 newAprBps);
    event DepositOpened(uint256 depositId, address owner, uint256 planId, uint256 principal, uint256 maturityAt, uint256 aprBpsAtOpen);
    event Withdrawn(uint256 depositId, address owner, uint256 principal, uint256 interest, bool isEarly);
    event Renewed(uint256 oldDepositId, uint256 newDepositId, uint256 newPrincipal, uint256 newPlanId);

    constructor(address _paymentToken, address _vaultManager) 
        ERC721("DepositCertificate", "DC") 
        Ownable(msg.sender) 
    {
        paymentToken = IERC20(_paymentToken);
        vaultManager = IVaultManager(_vaultManager);
    }

    // Admin Functions (Section 4)
    function createPlan(
        uint256 minAmount,
        uint256 maxAmount,
        uint256 tenorDays,
        uint256 aprBps,
        uint256 penaltyBps
    ) external onlyOwner {
        require(tenorDays > 0, "Tenor must be positive");
        require(aprBps <= 10000, "APR cannot exceed 100%");
        
        uint256 planId = _planCounter++;
        plans[planId] = SavingPlan({
            minAmount: minAmount,
            maxAmount: maxAmount,
            tenorDays: tenorDays,
            aprBps: aprBps,
            penaltyBps: penaltyBps,
            enabled: true
        });
        emit PlanCreated(planId, tenorDays, aprBps);
    }

    function updatePlan(uint256 planId, uint256 newAprBps) external onlyOwner {
        require(plans[planId].tenorDays > 0, "Plan does not exist");
        require(newAprBps <= 10000, "APR cannot exceed 100%");
        plans[planId].aprBps = newAprBps;
        emit PlanUpdated(planId, newAprBps);
    }

    function enablePlan(uint256 planId) external onlyOwner {
        require(plans[planId].tenorDays > 0, "Plan does not exist");
        plans[planId].enabled = true;
    }

    function disablePlan(uint256 planId) external onlyOwner {
        require(plans[planId].tenorDays > 0, "Plan does not exist");
        plans[planId].enabled = false;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // User Flows (Section 3)
    function openDeposit(uint256 planId, uint256 amount) external nonReentrant whenNotPaused {
        SavingPlan memory plan = plans[planId];
        require(plan.enabled, "Plan not enabled");
        if (plan.minAmount > 0) require(amount >= plan.minAmount, "Below minimum");
        if (plan.maxAmount > 0) require(amount <= plan.maxAmount, "Above maximum");

        paymentToken.transferFrom(msg.sender, address(this), amount);

        uint256 depositId = _depositCounter++;
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
        emit DepositOpened(depositId, msg.sender, planId, amount, maturityAt, plan.aprBps);
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

        emit Withdrawn(depositId, msg.sender, deposit.principal, interest, false);
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

        emit Withdrawn(depositId, msg.sender, deposit.principal, 0, true);
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

        if (newPlan.minAmount > 0) require(newPrincipal >= newPlan.minAmount, "New principal below min");
        if (newPlan.maxAmount > 0) require(newPrincipal <= newPlan.maxAmount, "New principal above max");

        deposit.status = DepositStatus.ManualRenewed;

        // Pull interest from Vault to Core to back the new principal
        vaultManager.payInterest(address(this), interest);

        uint256 newDepositId = _depositCounter++;
        uint256 newMaturityAt = block.timestamp + newPlan.tenorDays * 86400;

        deposits[newDepositId] = DepositCertificate({
            planId: newPlanId,
            principal: newPrincipal,
            tenorDays: newPlan.tenorDays,
            aprBpsAtOpen: newPlan.aprBps,
            penaltyBpsAtOpen: newPlan.penaltyBps,
            startAt: block.timestamp,
            maturityAt: newMaturityAt,
            status: DepositStatus.Active
        });

        _safeMint(msg.sender, newDepositId);
        emit Renewed(depositId, newDepositId, newPrincipal, newPlanId);
    }

    function autoRenewDeposit(uint256 depositId) external nonReentrant whenNotPaused {
        DepositCertificate storage deposit = deposits[depositId];
        require(deposit.status == DepositStatus.Active, "Not active");
        require(block.timestamp >= deposit.maturityAt + 3 days, "Within grace period");

        uint256 interest = _calculateInterest(deposit.principal, deposit.aprBpsAtOpen, deposit.tenorDays);
        uint256 newPrincipal = deposit.principal + interest;

        deposit.status = DepositStatus.AutoRenewed;

        // Pull interest from Vault to Core
        vaultManager.payInterest(address(this), interest);

        uint256 newDepositId = _depositCounter++;
        uint256 newMaturityAt = block.timestamp + deposit.tenorDays * 86400;

        deposits[newDepositId] = DepositCertificate({
            planId: deposit.planId,
            principal: newPrincipal,
            tenorDays: deposit.tenorDays,
            aprBpsAtOpen: deposit.aprBpsAtOpen, // Preserve original APR (Section 3.5)
            penaltyBpsAtOpen: deposit.penaltyBpsAtOpen,
            startAt: block.timestamp,
            maturityAt: newMaturityAt,
            status: DepositStatus.Active
        });

        _safeMint(ownerOf(depositId), newDepositId);
        emit Renewed(depositId, newDepositId, newPrincipal, deposit.planId);
    }

    function getDeposit(uint256 depositId) external view returns (DepositCertificate memory) {
        return deposits[depositId];
    }

    function getPlan(uint256 planId) external view returns (SavingPlan memory) {
        return plans[planId];
    }

    function _calculateInterest(uint256 principal, uint256 aprBps, uint256 tenorDays) internal pure returns (uint256) {
        // formula: interest = (principal * aprBps * tenorDays * 86400) / (365 * 24 * 3600 * 10,000)
        // simplified: (principal * aprBps * tenorDays) / (365 * 10,000)
        return (principal * aprBps * tenorDays) / (365 * 10000);
    }
}