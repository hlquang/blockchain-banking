export const DepositStatus = {
  Active: 0,
  Withdrawn: 1,
  ManualRenewed: 2,
  AutoRenewed: 3,
} as const;

export type DepositStatus = (typeof DepositStatus)[keyof typeof DepositStatus];

export interface SavingPlan {
  id: number;
  minAmount: bigint;
  maxAmount: bigint;
  tenorDays: number;
  aprBps: number;
  penaltyBps: number;
  enabled: boolean;
}

export interface Deposit {
  id: number;
  planId: number;
  owner: string;
  principal: bigint;
  tenorDays: number;
  aprBpsAtOpen: number;
  penaltyBpsAtOpen: number;
  startAt: number;
  maturityAt: number;
  status: DepositStatus;
}
