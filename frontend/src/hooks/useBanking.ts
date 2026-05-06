import { useCallback } from "react";
import { Contract, formatUnits, parseUnits } from "ethers";

import { DepositStatus } from "../types";
import type { SavingPlan, Deposit } from "../types";

export function useBanking(
  mockUSDC: Contract | null,
  vaultManager: Contract | null,
  savingCore: Contract | null,
  account: string | null
) {
  const getBalance = useCallback(async () => {
    if (!mockUSDC || !account) return "0";
    const bal = await mockUSDC.balanceOf(account);
    return formatUnits(bal, 6);
  }, [mockUSDC, account]);

  const getFaucet = useCallback(async (amount?: string) => {
    if (!mockUSDC || !account) return;
    const amt = amount ? parseUnits(amount, 6) : parseUnits("1000", 6);
    const tx = await mockUSDC.mint(account, amt);
    await tx.wait();
  }, [mockUSDC, account]);

  const getPlans = useCallback(async () => {
    if (!savingCore) return [];
    const plans: SavingPlan[] = [];
    let i = 0;
    while (true) {
      try {
        const p = await savingCore.getPlan(i);
        if (p.tenorDays === 0n) break;
        plans.push({
          id: i,
          minAmount: p.minAmount,
          maxAmount: p.maxAmount,
          tenorDays: Number(p.tenorDays),
          aprBps: Number(p.aprBps),
          penaltyBps: Number(p.penaltyBps),
          enabled: p.enabled,
        });
        i++;
      } catch {
        break;
      }
    }
    return plans;
  }, [savingCore]);

  const openDeposit = useCallback(
    async (planId: number, amount: string) => {
      if (!savingCore || !mockUSDC || !account) return;
      const amt = parseUnits(amount, 6);
      const balance = await mockUSDC.balanceOf(account);
      if (balance < amt) throw new Error("Insufficient mUSDC balance");
      const allowance = await mockUSDC.allowance(account, savingCore.target);
      if (allowance < amt) {
        const appTx = await mockUSDC.approve(savingCore.target, amt);
        await appTx.wait();
      }
      const tx = await savingCore.openDeposit(planId, amt);
      await tx.wait();
    },
    [savingCore, mockUSDC, account]
  );

  const getUserDeposits = useCallback(async (): Promise<Deposit[]> => {
    if (!savingCore || !account) return [];
    const deposits: Deposit[] = [];
    const total = Number(await savingCore.totalDeposits());
    for (let i = 0; i < total; i++) {
      try {
        const owner = await savingCore.ownerOf(i);
        if (owner.toLowerCase() === account.toLowerCase()) {
          const d = await savingCore.getDeposit(i);
          deposits.push({
            id: i,
            planId: Number(d.planId),
            principal: d.principal,
            tenorDays: Number(d.tenorDays),
            aprBpsAtOpen: Number(d.aprBpsAtOpen),
            penaltyBpsAtOpen: Number(d.penaltyBpsAtOpen),
            startAt: Number(d.startAt),
            maturityAt: Number(d.maturityAt),
            status: Number(d.status) as DepositStatus,
          });
        }
      } catch (e) {
        console.log(`getUserDeposits: failed at index ${i}`, e);
        continue;
      }
    }
    return deposits;
  }, [savingCore, account]);

  const getAllDeposits = useCallback(async (): Promise<Deposit[]> => {
    if (!savingCore) return [];
    const deposits: Deposit[] = [];
    const total = Number(await savingCore.totalDeposits());
    for (let i = 0; i < total; i++) {
      try {
        const d = await savingCore.getDeposit(i);
        deposits.push({
          id: i,
          planId: Number(d.planId),
          owner: await savingCore.ownerOf(i),
          principal: d.principal,
          tenorDays: Number(d.tenorDays),
          aprBpsAtOpen: Number(d.aprBpsAtOpen),
          penaltyBpsAtOpen: Number(d.penaltyBpsAtOpen),
          startAt: Number(d.startAt),
          maturityAt: Number(d.maturityAt),
          status: Number(d.status) as DepositStatus,
        });
      } catch (e) {
        console.log(`getAllDeposits: failed at index ${i}`, e);
        continue;
      }
    }
    return deposits;
  }, [savingCore]);

  const withdraw = useCallback(
    async (depositId: number) => {
      if (!savingCore) return;
      const tx = await savingCore.withdrawAtMaturity(depositId);
      await tx.wait();
    },
    [savingCore]
  );

  const earlyWithdraw = useCallback(
    async (depositId: number) => {
      if (!savingCore) return;
      const tx = await savingCore.earlyWithdraw(depositId);
      await tx.wait();
    },
    [savingCore]
  );

  const renewDeposit = useCallback(
    async (depositId: number, newPlanId: number) => {
      if (!savingCore) return;
      const tx = await savingCore.renewDeposit(depositId, newPlanId);
      await tx.wait();
    },
    [savingCore]
  );

  // Admin functions
  const createPlan = useCallback(
    async (minAmount: bigint, maxAmount: bigint, tenorDays: number, aprBps: number, penaltyBps: number) => {
      if (!savingCore) return;
      const tx = await savingCore.createPlan(minAmount, maxAmount, tenorDays, aprBps, penaltyBps);
      await tx.wait();
    },
    [savingCore]
  );

  const updatePlan = useCallback(
    async (planId: number, newAprBps: number) => {
      if (!savingCore) return;
      const tx = await savingCore.updatePlan(planId, newAprBps);
      await tx.wait();
    },
    [savingCore]
  );

  const enablePlan = useCallback(
    async (planId: number) => {
      if (!savingCore) return;
      const tx = await savingCore.enablePlan(planId);
      await tx.wait();
    },
    [savingCore]
  );

  const disablePlan = useCallback(
    async (planId: number) => {
      if (!savingCore) return;
      const tx = await savingCore.disablePlan(planId);
      await tx.wait();
    },
    [savingCore]
  );

  const fundVault = useCallback(
    async (amount: string) => {
      if (!vaultManager || !mockUSDC || !account) return;
      const amt = parseUnits(amount, 6);
      const balance = await mockUSDC.balanceOf(account);
      if (balance < amt) throw new Error("Insufficient mUSDC balance");
      const allowance = await mockUSDC.allowance(account, vaultManager.target);
      if (allowance < amt) {
        const appTx = await mockUSDC.approve(vaultManager.target, amt);
        await appTx.wait();
      }
      const tx = await vaultManager.fundVault(amt);
      await tx.wait();
    },
    [vaultManager, mockUSDC, account]
  );

  const withdrawVault = useCallback(
    async (amount: string) => {
      if (!vaultManager || !account) return;
      const amt = parseUnits(amount, 6);
      const tx = await vaultManager.withdrawVault(amt);
      await tx.wait();
    },
    [vaultManager, account]
  );

  const getVaultBalance = useCallback(async () => {
    if (!vaultManager) return "0";
    const bal = await vaultManager.totalVaultFunds();
    return formatUnits(bal, 6);
  }, [vaultManager]);

  const setFeeReceiver = useCallback(
    async (address: string) => {
      if (!vaultManager) return;
      const tx = await vaultManager.setFeeReceiver(address);
      await tx.wait();
    },
    [vaultManager]
  );

  const pauseSystem = useCallback(async () => {
    if (!savingCore) return;
    const tx = await savingCore.pause();
    await tx.wait();
  }, [savingCore]);

  const unpauseSystem = useCallback(async () => {
    if (!savingCore) return;
    const tx = await savingCore.unpause();
    await tx.wait();
  }, [savingCore]);

  const getCurrentTimestamp = useCallback(async () => {
    if (!savingCore) return 0;
    return Number(await savingCore.getCurrentTimestamp());
  }, [savingCore]);

  const getIsPaused = useCallback(async () => {
    if (!savingCore) return false;
    return await savingCore.paused();
  }, [savingCore]);

  return {
    getBalance, getFaucet, getPlans, openDeposit, getUserDeposits, getAllDeposits,
    withdraw, earlyWithdraw, renewDeposit,
    createPlan, updatePlan, enablePlan, disablePlan, fundVault, withdrawVault, getVaultBalance, setFeeReceiver,
    pauseSystem, unpauseSystem, getIsPaused, getCurrentTimestamp,
  };
}
