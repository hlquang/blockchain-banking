// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract VaultManager is Ownable, Pausable {
    IERC20 public immutable token;
    address public feeReceiver;
    uint256 public totalVaultFunds;

    event VaultFunded(address indexed from, uint256 amount, uint256 newBalance);
    event VaultWithdrawn(address indexed to, uint256 amount, uint256 newBalance);
    event InterestPaid(address indexed to, uint256 amount);
    event FeeReceiverUpdated(address indexed oldReceiver, address indexed newReceiver);
    event PausedSet(bool paused);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
        feeReceiver = msg.sender;
    }

    function fundVault(uint256 amount) external onlyOwner whenNotPaused {
        require(amount > 0, "Amount must be positive");
        token.transferFrom(msg.sender, address(this), amount);
        totalVaultFunds += amount;
        emit VaultFunded(msg.sender, amount, totalVaultFunds);
    }

    function withdrawFromVault(uint256 amount) external onlyOwner whenNotPaused {
        require(amount > 0, "Amount must be positive");
        require(amount <= totalVaultFunds, "Insufficient vault funds");
        totalVaultFunds -= amount;
        token.transfer(msg.sender, amount);
        emit VaultWithdrawn(msg.sender, amount, totalVaultFunds);
    }

    function payInterest(address to, uint256 amount) external onlyOwner whenNotPaused {
        require(amount > 0, "Amount must be positive");
        require(amount <= totalVaultFunds, "Insufficient vault funds");
        totalVaultFunds -= amount;
        token.transfer(to, amount);
        emit InterestPaid(to, amount);
    }

    function setFeeReceiver(address newReceiver) external onlyOwner {
        require(newReceiver != address(0), "Zero address");
        address oldReceiver = feeReceiver;
        feeReceiver = newReceiver;
        emit FeeReceiverUpdated(oldReceiver, newReceiver);
    }

    function getVaultBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function pause() external onlyOwner {
        _pause();
        emit PausedSet(true);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit PausedSet(false);
    }
}