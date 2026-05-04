import { useState } from "react";
import { Clock, Percent, Coins, ArrowRight, Loader2, Ban } from "lucide-react";
import type { SavingPlan } from "../types";
import { formatAmount, aprPercent } from "../utils/helpers";

interface PlansViewProps {
  plans: SavingPlan[];
  userBalance: string;
  isPaused: boolean;
  onDeposit: (planId: number, amount: string) => Promise<void>;
}

export default function PlansView({ plans, userBalance, isPaused, onDeposit }: PlansViewProps) {
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  const handleDeposit = async (planId: number) => {
    setLoading((s) => ({ ...s, [planId]: true }));
    try {
      await onDeposit(planId, amounts[planId] || "100");
      setAmounts((s) => ({ ...s, [planId]: "" }));
    } finally {
      setLoading((s) => ({ ...s, [planId]: false }));
    }
  };

  const enabledPlans = plans.filter((p) => p.enabled);
  const balanceNum = parseFloat(userBalance);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Saving Plans</h2>
      {enabledPlans.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
          <Coins size={48} className="mx-auto text-text-secondary mb-3" />
          <p className="text-text-secondary">{isPaused ? "System is paused by admin — no plans available" : "No plans available yet. Check back later."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enabledPlans.map((plan) => (
            <div key={plan.id} className="bg-bg-card border border-border rounded-xl p-5 hover:border-accent/30 transition">
              <div className="flex items-center justify-between mb-4">
                <span className="text-accent font-mono text-sm">Plan #{plan.id}</span>
                <div className="flex items-center gap-1 text-text-secondary text-sm">
                  {isPaused && <Ban size={12} className="text-danger" />}
                  <Clock size={14} />
                  <span>{plan.tenorDays} days</span>
                </div>
              </div>
              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{aprPercent(plan.aprBps)}</span>
                  <Percent size={20} className="text-text-secondary" />
                </div>
                <p className="text-text-secondary text-xs mt-1">APR</p>
              </div>
              <div className="text-xs text-text-secondary space-y-1 mb-4">
                <p>Min: {formatAmount(plan.minAmount)} mUSDC</p>
                <p>Max: {formatAmount(plan.maxAmount)} mUSDC</p>
                <p>Penalty: {plan.penaltyBps / 100}%</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount"
                  value={amounts[plan.id] || ""}
                  onChange={(e) => setAmounts((s) => ({ ...s, [plan.id]: e.target.value }))}
                  className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent transition"
                  disabled={isPaused}
                />
                <button
                  onClick={() => handleDeposit(plan.id)}
                  disabled={loading[plan.id] || !amounts[plan.id] || isPaused}
                  className="flex items-center gap-1 bg-accent px-4 rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50 whitespace-nowrap"
                >
                  {loading[plan.id] ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : isPaused ? (
                    <Ban size={16} />
                  ) : (
                    <>
                      Open <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
              {(() => {
                const amt = amounts[plan.id];
                if (!amt || parseFloat(amt) <= 0) return null;
                const val = parseFloat(amt);
                const min = parseFloat(formatAmount(plan.minAmount));
                const max = parseFloat(formatAmount(plan.maxAmount));
                if (val > balanceNum) return <p className="text-danger text-xs mt-1">Insufficient mUSDC balance</p>;
                if (val < min) return <p className="text-warning text-xs mt-1">Below minimum ({min} mUSDC)</p>;
                if (val > max) return <p className="text-warning text-xs mt-1">Above maximum ({max} mUSDC)</p>;
                return null;
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
