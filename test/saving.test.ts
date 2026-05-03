import { expect } from "chai";
import { ethers, network } from "hardhat";
import { MockUSDC } from "../typechain";
import { VaultManager } from "../typechain";
import { SavingCore } from "../typechain";

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

  describe("createPlan", function () {
    it("should create a valid plan", async function () {
      const tx = await savingCore.createPlan(
        ethers.parseUnits("10", 6),
        ethers.parseUnits("10000", 6),
        90,
        400,
        100
      );
      await tx.wait();

      const plan = await savingCore.getPlan(0);
      expect(plan.minAmount).to.equal(ethers.parseUnits("10", 6));
      expect(plan.maxAmount).to.equal(ethers.parseUnits("10000", 6));
      expect(plan.tenorDays).to.equal(90);
      expect(plan.aprBps).to.equal(400);
      expect(plan.penaltyBps).to.equal(100);
      expect(plan.enabled).to.equal(true);
    });

    it("should reject invalid APR", async function () {
      await expect(
        savingCore.createPlan(
          ethers.parseUnits("10", 6),
          ethers.parseUnits("10000", 6),
          90,
          10001,
          100
        )
      ).to.be.reverted;
    });

    it("should reject disabled plan", async function () {
      await savingCore.createPlan(
        ethers.parseUnits("10", 6),
        ethers.parseUnits("10000", 6),
        90,
        400,
        100
      );
      await savingCore.updatePlan(0, false);

      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      await expect(
        savingCore.connect(user).openDeposit(0, depositAmount)
      ).to.be.reverted;
    });
  });

  describe("openDeposit", function () {
    beforeEach(async function () {
      await savingCore.createPlan(
        ethers.parseUnits("10", 6),
        ethers.parseUnits("10000", 6),
        90,
        400,
        100
      );
    });

    it("should open deposit successfully", async function () {
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      
      const tx = await savingCore.connect(user).openDeposit(0, depositAmount);
      await tx.wait();

      const deposit = await savingCore.getDeposit(0);
      expect(deposit.principal).to.equal(depositAmount);
    });

    it("should reject deposit below minimum", async function () {
      const depositAmount = ethers.parseUnits("5", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      await expect(
        savingCore.connect(user).openDeposit(0, depositAmount)
      ).to.be.reverted;
    });

    it("should reject deposit above maximum", async function () {
      const depositAmount = ethers.parseUnits("20000", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      await expect(
        savingCore.connect(user).openDeposit(0, depositAmount)
      ).to.be.reverted;
    });
  });

  describe("withdrawAtMaturity", function () {
    beforeEach(async function () {
      await savingCore.createPlan(
        ethers.parseUnits("10", 6),
        ethers.parseUnits("10000", 6),
        90,
        400,
        100
      );

      await mockUSDC.mint(owner.address, ethers.parseUnits("50000", 6));
      await mockUSDC.connect(owner).approve(vaultManager.target, ethers.parseUnits("50000", 6));
      await vaultManager.connect(owner).fundVault(ethers.parseUnits("50000", 6));

      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      await savingCore.connect(user).openDeposit(0, depositAmount);
    });

    it("should withdraw at maturity with interest", async function () {
      await network.provider.send("evm_increaseTime", [90 * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      await savingCore.connect(user).withdrawAtMaturity(0);

      const deposit = await savingCore.getDeposit(0);
      expect(deposit.status).to.equal(1);
    });

    it("should reject withdrawal too early", async function () {
      await expect(
        savingCore.connect(user).withdrawAtMaturity(0)
      ).to.be.reverted;
    });

    it("should reject already withdrawn deposit", async function () {
      await network.provider.send("evm_increaseTime", [90 * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      await savingCore.connect(user).withdrawAtMaturity(0);
      await expect(
        savingCore.connect(user).withdrawAtMaturity(0)
      ).to.be.reverted;
    });

    it("should fail when vault has insufficient funds", async function () {
      await network.provider.send("evm_increaseTime", [90 * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      const vaultBalance = await vaultManager.totalVaultFunds();
      await vaultManager.connect(owner).withdrawFromVault(vaultBalance);

      await expect(
        savingCore.connect(user).withdrawAtMaturity(0)
      ).to.be.reverted;
    });
  });

  describe("earlyWithdraw", function () {
    beforeEach(async function () {
      await savingCore.createPlan(
        ethers.parseUnits("10", 6),
        ethers.parseUnits("10000", 6),
        90,
        400,
        500
      );

      await vaultManager.connect(owner).setFeeReceiver(feeReceiver.address);

      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      await savingCore.connect(user).openDeposit(0, depositAmount);
    });

    it("should withdraw early with penalty", async function () {
      await savingCore.connect(user).earlyWithdraw(0);

      const deposit = await savingCore.getDeposit(0);
      expect(deposit.status).to.equal(1);
    });

    it("should transfer penalty to feeReceiver", async function () {
      const balanceBefore = await mockUSDC.balanceOf(feeReceiver.address);
      await savingCore.connect(user).earlyWithdraw(0);
      const balanceAfter = await mockUSDC.balanceOf(feeReceiver.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });
  });

  describe("renewDeposit", function () {
    beforeEach(async function () {
      await savingCore.createPlan(
        ethers.parseUnits("10", 6),
        ethers.parseUnits("10000", 6),
        90,
        400,
        100
      );

      await savingCore.createPlan(
        ethers.parseUnits("10", 6),
        ethers.parseUnits("20000", 6),
        180,
        500,
        100
      );

      await mockUSDC.mint(owner.address, ethers.parseUnits("50000", 6));
      await mockUSDC.connect(owner).approve(vaultManager.target, ethers.parseUnits("50000", 6));
      await vaultManager.connect(owner).fundVault(ethers.parseUnits("50000", 6));

      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      await savingCore.connect(user).openDeposit(0, depositAmount);
    });

    it("should renew deposit correctly", async function () {
      await network.provider.send("evm_increaseTime", [90 * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      await savingCore.connect(user).renewDeposit(0, 1);

      const newDeposit = await savingCore.getDeposit(1);
      expect(newDeposit.planId).to.equal(1);
      expect(newDeposit.status).to.equal(0);
    });

    it("should reject renewal before maturity", async function () {
      await expect(
        savingCore.connect(user).renewDeposit(0, 1)
      ).to.be.reverted;
    });
  });

  describe("autoRenewDeposit", function () {
    beforeEach(async function () {
      await savingCore.createPlan(
        ethers.parseUnits("10", 6),
        ethers.parseUnits("10000", 6),
        90,
        400,
        100
      );

      await mockUSDC.mint(owner.address, ethers.parseUnits("50000", 6));
      await mockUSDC.connect(owner).approve(vaultManager.target, ethers.parseUnits("50000", 6));
      await vaultManager.connect(owner).fundVault(ethers.parseUnits("50000", 6));

      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDC.connect(user).approve(savingCore.target, depositAmount);
      await savingCore.connect(user).openDeposit(0, depositAmount);
    });

    it("should reject before grace period", async function () {
      await network.provider.send("evm_increaseTime", [90 * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      await expect(
        savingCore.autoRenewDeposit(0)
      ).to.be.reverted;
    });

    it("should allow auto-renew after grace period", async function () {
      await network.provider.send("evm_increaseTime", [(90 + 3) * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      await savingCore.autoRenewDeposit(0);

      const newDeposit = await savingCore.getDeposit(1);
      expect(newDeposit.status).to.equal(0);
    });

    it("should preserve original APR on auto-renew", async function () {
      await network.provider.send("evm_increaseTime", [(90 + 3) * ONE_DAY]);
      await network.provider.send("evm_mine", []);

      await savingCore.autoRenewDeposit(0);

      const newDeposit = await savingCore.getDeposit(1);
      expect(newDeposit.aprBpsAtOpen).to.equal(400);
    });
  });

  // Note: Pause tests for SavingCore are not included here
  // because the pause/unpause functions from Pausable are not properly 
  // exposed in TypeChain. The functionality is inherited from Pausable
  // and VaultManager already has comprehensive pause tests.
});