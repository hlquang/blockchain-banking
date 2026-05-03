import { expect } from "chai";
import { ethers, network } from "hardhat";
import { MockUSDC, VaultManager, SavingCore } from "../typechain";

const ONE_DAY = 86400;

describe("SavingCore", function () {
  let mockUSDC: MockUSDC;
  let vaultManager: VaultManager;
  let savingCore: SavingCore;
  let owner: any;
  let user: any;
  let otherUser: any;
  let feeReceiver: any;

  beforeEach(async function () {
    [owner, user, otherUser, feeReceiver] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy() as MockUSDC;
    await mockUSDC.waitForDeployment();

    const VaultManager = await ethers.getContractFactory("VaultManager");
    vaultManager = await VaultManager.deploy(await mockUSDC.getAddress()) as VaultManager;
    await vaultManager.waitForDeployment();

    const SavingCore = await ethers.getContractFactory("SavingCore");
    savingCore = await SavingCore.deploy(await mockUSDC.getAddress(), await vaultManager.getAddress()) as SavingCore;
    await savingCore.waitForDeployment();

    const mintAmount = ethers.parseUnits("100000", 6);
    await mockUSDC.mint(user.address, mintAmount);
    await mockUSDC.mint(otherUser.address, mintAmount);
  });

  describe("Admin Functions", function () {
    it("should create a valid plan", async function () {
      await expect(savingCore.createPlan(
        ethers.parseUnits("10", 6),
        ethers.parseUnits("10000", 6),
        90,
        400,
        100
      )).to.emit(savingCore, "PlanCreated").withArgs(0, 90, 400);

      const plan = await savingCore.getPlan(0);
      expect(plan.tenorDays).to.equal(90);
      expect(plan.aprBps).to.equal(400);
      expect(plan.enabled).to.equal(true);
    });

    it("should update plan APR", async function () {
      await savingCore.createPlan(ethers.parseUnits("10", 6), ethers.parseUnits("10000", 6), 90, 400, 100);
      await expect(savingCore.updatePlan(0, 500))
        .to.emit(savingCore, "PlanUpdated").withArgs(0, 500);
      
      const plan = await savingCore.getPlan(0);
      expect(plan.aprBps).to.equal(500);
    });

    it("should enable/disable plans", async function () {
      await savingCore.createPlan(ethers.parseUnits("10", 6), ethers.parseUnits("10000", 6), 90, 400, 100);
      
      await savingCore.disablePlan(0);
      expect((await savingCore.getPlan(0)).enabled).to.equal(false);
      
      await savingCore.enablePlan(0);
      expect((await savingCore.getPlan(0)).enabled).to.equal(true);
    });
  });

  describe("openDeposit", function () {
    beforeEach(async function () {
      await savingCore.createPlan(ethers.parseUnits("10", 6), ethers.parseUnits("10000", 6), 90, 400, 100);
    });

    it("should open deposit and emit DepositOpened", async function () {
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      
      await expect(savingCore.connect(user).openDeposit(0, depositAmount))
        .to.emit(savingCore, "DepositOpened");

      const deposit = await savingCore.getDeposit(0);
      expect(deposit.principal).to.equal(depositAmount);
    });
  });

  describe("withdrawAtMaturity", function () {
    beforeEach(async function () {
      await savingCore.createPlan(ethers.parseUnits("10", 6), ethers.parseUnits("10000", 6), 90, 400, 100);
      await mockUSDC.mint(owner.address, ethers.parseUnits("50000", 6));
      await mockUSDC.connect(owner).approve(vaultManager.target, ethers.parseUnits("50000", 6));
      await vaultManager.connect(owner).fundVault(ethers.parseUnits("50000", 6));

      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      await savingCore.connect(user).openDeposit(0, depositAmount);
    });

    it("should withdraw at maturity and emit Withdrawn", async function () {
      await network.provider.send("evm_increaseTime", [90 * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      const interest = (BigInt(1000 * 10**6) * BigInt(400) * BigInt(90)) / BigInt(365 * 10000);

      await expect(savingCore.connect(user).withdrawAtMaturity(0))
        .to.emit(savingCore, "Withdrawn")
        .withArgs(0, user.address, ethers.parseUnits("1000", 6), interest, false);
    });
  });

  describe("earlyWithdraw", function () {
    beforeEach(async function () {
      await savingCore.createPlan(ethers.parseUnits("10", 6), ethers.parseUnits("10000", 6), 90, 400, 500);
      await vaultManager.connect(owner).setFeeReceiver(feeReceiver.address);

      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      await savingCore.connect(user).openDeposit(0, depositAmount);
    });

    it("should withdraw early with penalty and emit Withdrawn", async function () {
      await expect(savingCore.connect(user).earlyWithdraw(0))
        .to.emit(savingCore, "Withdrawn")
        .withArgs(0, user.address, ethers.parseUnits("1000", 6), 0, true);
    });
  });

  describe("renewDeposit", function () {
    beforeEach(async function () {
      await savingCore.createPlan(ethers.parseUnits("10", 6), ethers.parseUnits("10000", 6), 90, 400, 100);
      await savingCore.createPlan(ethers.parseUnits("10", 6), ethers.parseUnits("20000", 6), 180, 500, 100);
      await mockUSDC.mint(owner.address, ethers.parseUnits("50000", 6));
      await mockUSDC.connect(owner).approve(vaultManager.target, ethers.parseUnits("50000", 6));
      await vaultManager.connect(owner).fundVault(ethers.parseUnits("50000", 6));

      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      await savingCore.connect(user).openDeposit(0, depositAmount);
    });

    it("should renew correctly and emit Renewed", async function () {
      await network.provider.send("evm_increaseTime", [90 * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      const interest = (BigInt(1000 * 10**6) * BigInt(400) * BigInt(90)) / BigInt(365 * 10000);
      const newPrincipal = ethers.parseUnits("1000", 6) + interest;

      await expect(savingCore.connect(user).renewDeposit(0, 1))
        .to.emit(savingCore, "Renewed")
        .withArgs(0, 1, newPrincipal, 1);
      
      expect(await mockUSDC.balanceOf(savingCore.target)).to.be.gt(ethers.parseUnits("1000", 6));
    });
  });

  describe("autoRenewDeposit", function () {
    beforeEach(async function () {
      await savingCore.createPlan(ethers.parseUnits("10", 6), ethers.parseUnits("10000", 6), 90, 400, 100);
      await mockUSDC.mint(owner.address, ethers.parseUnits("50000", 6));
      await mockUSDC.connect(owner).approve(vaultManager.target, ethers.parseUnits("50000", 6));
      await vaultManager.connect(owner).fundVault(ethers.parseUnits("50000", 6));

      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      await savingCore.connect(user).openDeposit(0, depositAmount);
    });

    it("should allow auto-renew after grace and preserve APR", async function () {
      await network.provider.send("evm_increaseTime", [(90 + 3) * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      await expect(savingCore.autoRenewDeposit(0)).to.emit(savingCore, "Renewed");

      const newDeposit = await savingCore.getDeposit(1);
      expect(newDeposit.aprBpsAtOpen).to.equal(400);
    });
  });
});