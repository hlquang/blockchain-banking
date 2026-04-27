import { expect } from "chai";
import { ethers } from "hardhat";
import { MockUSDC } from "../typechain";

describe("MockUSDC", function () {
  let mockUSDC: MockUSDC;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy() as MockUSDC;
    await mockUSDC.waitForDeployment();
  });

  it("should have correct name and symbol", async function () {
    expect(await mockUSDC.name()).to.equal("Mock USDC");
    expect(await mockUSDC.symbol()).to.equal("mUSDC");
  });

  it("should have 6 decimals", async function () {
    expect(Number(await mockUSDC.decimals())).to.equal(6);
  });

  it("should allow minting tokens", async function () {
    const mintAmount = ethers.parseUnits("1000", 6);
    await mockUSDC.mint(user.address, mintAmount);
    expect(await mockUSDC.balanceOf(user.address)).to.equal(mintAmount);
  });

  it("should handle transfer correctly", async function () {
    const mintAmount = ethers.parseUnits("1000", 6);
    const transferAmount = ethers.parseUnits("500", 6);

    await mockUSDC.mint(owner.address, mintAmount);
    await mockUSDC.transfer(user.address, transferAmount);

    expect(await mockUSDC.balanceOf(user.address)).to.equal(transferAmount);
    expect(await mockUSDC.balanceOf(owner.address)).to.equal(mintAmount - transferAmount);
  });
});

describe("VaultManager", function () {
  let vaultManager: any;
  let mockUSDC: MockUSDC;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy() as MockUSDC;
    await mockUSDC.waitForDeployment();

    const VaultManager = await ethers.getContractFactory("VaultManager");
    vaultManager = await VaultManager.deploy(await mockUSDC.getAddress()) as any;
    await vaultManager.waitForDeployment();

    const mintAmount = ethers.parseUnits("10000", 6);
    await mockUSDC.mint(owner.address, mintAmount);
  });

  it("should set correct token address", async function () {
    expect(await vaultManager.token()).to.equal(await mockUSDC.getAddress());
  });

  it("should set feeReceiver to deployer", async function () {
    expect(await vaultManager.feeReceiver()).to.equal(owner.address);
  });

  it("should allow funding vault", async function () {
    const fundAmount = ethers.parseUnits("5000", 6);
    await mockUSDC.approve(vaultManager.target, fundAmount);
    await vaultManager.fundVault(fundAmount);

    expect(await vaultManager.totalVaultFunds()).to.equal(fundAmount);
    expect(await mockUSDC.balanceOf(vaultManager.target)).to.equal(fundAmount);
  });

  it("should allow admin to withdraw from vault", async function () {
    const fundAmount = ethers.parseUnits("5000", 6);
    await mockUSDC.approve(vaultManager.target, fundAmount);
    await vaultManager.fundVault(fundAmount);

    const withdrawAmount = ethers.parseUnits("2000", 6);
    const ownerBalanceBefore = await mockUSDC.balanceOf(owner.address);

    await vaultManager.withdrawFromVault(withdrawAmount);

    expect(await vaultManager.totalVaultFunds()).to.equal(fundAmount - withdrawAmount);
    expect(await mockUSDC.balanceOf(owner.address)).to.equal(ownerBalanceBefore + withdrawAmount);
  });

  it("should allow paying interest", async function () {
    const fundAmount = ethers.parseUnits("5000", 6);
    await mockUSDC.approve(vaultManager.target, fundAmount);
    await vaultManager.fundVault(fundAmount);

    const interestAmount = ethers.parseUnits("100", 6);
    const userBalanceBefore = await mockUSDC.balanceOf(user.address);

    await vaultManager.payInterest(user.address, interestAmount);

    expect(await vaultManager.totalVaultFunds()).to.equal(fundAmount - interestAmount);
    expect(await mockUSDC.balanceOf(user.address)).to.equal(userBalanceBefore + interestAmount);
  });

  it("should allow updating feeReceiver", async function () {
    await vaultManager.setFeeReceiver(user.address);
    expect(await vaultManager.feeReceiver()).to.equal(user.address);
  });

  it("should allow pausing and unpausing", async function () {
    await vaultManager.pause();
    expect(await vaultManager.paused()).to.equal(true);

    await vaultManager.unpause();
    expect(await vaultManager.paused()).to.equal(false);
  });

  it("should block operations when paused", async function () {
    const fundAmount = ethers.parseUnits("1000", 6);
    await mockUSDC.approve(vaultManager.target, fundAmount);
    await vaultManager.fundVault(fundAmount);

    await vaultManager.pause();

    await expect(vaultManager.fundVault(fundAmount)).to.be.reverted;
    await expect(vaultManager.withdrawFromVault(fundAmount)).to.be.reverted;
  });
});