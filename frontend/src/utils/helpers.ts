import { formatUnits } from "ethers";

export function formatAmount(amount: bigint, decimals = 6): string {
  return formatUnits(amount, decimals);
}

export function daysRemaining(maturityAt: number): number {
  const now = Math.floor(Date.now() / 1000);
  const diff = maturityAt - now;
  return Math.max(0, Math.ceil(diff / 86400));
}

export function isMatured(maturityAt: number): boolean {
  return Math.floor(Date.now() / 1000) >= maturityAt;
}

export function statusLabel(status: number): string {
  switch (status) {
    case 0: return "Active";
    case 1: return "Withdrawn";
    case 2: return "Manual Renewed";
    case 3: return "Auto Renewed";
    default: return "Unknown";
  }
}

export function aprPercent(aprBps: number): string {
  return (aprBps / 100).toFixed(2) + "%";
}
