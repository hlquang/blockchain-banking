import { useState } from "react";
import { ScrollText, Clock, Timer, TrendingUp, Loader2, Banknote, AlertTriangle, Ban } from "lucide-react";
import type { Deposit } from "../types";
import { formatAmount, statusLabel } from "../utils/helpers";

interface DepositsViewProps {
  deposits: Deposit[];
  vaultBalance: string;
  isPaused: boolean;
  blockTimestamp: number;
  onWithdraw: (id: number) => Promise<void>;
  onEarlyWithdraw: (id: number) => Promise<void>;
  onRenew: (id: number, newPlanId: number) => Promise<void>;
}

function minterest(principal: bigint, aprBps: number, tenorDays: number): bigint {
  return (principal * BigInt(aprBps) * BigInt(tenorDays)) / BigInt(365 * 10000);
}

export default function DepositsView({ deposits, vaultBalance, isPaused, blockTimestamp, onWithdraw, onEarlyWithdraw, onRenew }: DepositsViewProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const vaultNum = parseFloat(vaultBalance);

  const isMatured = (maturityAt: number) => blockTimestamp >= maturityAt;
  const daysRemaining = (maturityAt: number) => Math.max(0, Math.ceil((maturityAt - blockTimestamp) / 86400));

  const active = deposits.filter((d) => d.status === 0);
  const history = deposits.filter((d) => d.status !== 0);

  const doAction = async (key: string, fn: () => Promise<void>) => {
    setLoading((s) => ({ ...s, [key]: true }));
    try { await fn(); } finally { setLoading((s) => ({ ...s, [key]: false })); }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">My Certificates</h2>
      {deposits.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
          <ScrollText size={48} className="mx-auto text-text-secondary mb-3" />
          <p className="text-text-secondary">No deposit certificates found. Open a plan to get started.</p>
        </div>
      ) : (
        <>
          {/* Active Deposits */}
          {active.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-medium text-text-secondary mb-3 uppercase tracking-wide">Active ({active.length})</h3>
              <div className="space-y-4">
                {active.map((dep) => {
            const matured = isMatured(dep.maturityAt);
            const daysLeft = daysRemaining(dep.maturityAt);
            const interest = minterest(dep.principal, dep.aprBpsAtOpen, dep.tenorDays);
            const total = dep.principal + interest;
            const keyPrefix = `dep-${dep.id}`;

            return (
              <div key={dep.id} className="bg-bg-card border border-border rounded-xl p-5 hover:border-accent/20 transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-xs font-bold shadow-lg">
                      DC
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Certificate #{dep.id}</span>
                        <span className="bg-accent/10 text-accent text-xs px-2 py-0.5 rounded-full">{statusLabel(dep.status)}</span>
                      </div>
                      <p className="text-text-secondary text-xs">Plan #{dep.planId} · {dep.tenorDays} days</p>
                    </div>
                  </div>
                  {matured && (
                    <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                      <Timer size={12} /> Matured
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-sm">
                  <div>
                    <p className="text-text-secondary text-xs">Principal</p>
                    <p className="font-mono font-medium">{formatAmount(dep.principal)} mUSDC</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-xs">Interest Earned</p>
                    <p className="font-mono font-medium text-accent">{formatAmount(interest)} mUSDC</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-xs">Total Value</p>
                    <p className="font-mono font-medium">{formatAmount(total)} mUSDC</p>
                  </div>
                  <div>
                    <p className="text-text-secondary text-xs">{matured ? "Grace ends" : "Matures in"}</p>
                    <p className="font-mono font-medium">{matured ? "Now" : `${daysLeft} days`}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {matured ? (
                    <>
                      <button
                        onClick={() => doAction(`withdraw-${dep.id}`, () => onWithdraw(dep.id))}
                        disabled={loading[`withdraw-${dep.id}`] || isPaused || vaultNum < Number(formatAmount(interest))}
                        className="flex items-center gap-1 bg-accent px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-accent-hover transition disabled:opacity-50"
                      >
                        {loading[`withdraw-${dep.id}`] ? <Loader2 size={14} className="animate-spin" /> : <Banknote size={14} />}
                        Withdraw
                      </button>
                      <button
                        onClick={() => doAction(`renew-${dep.id}`, () => onRenew(dep.id, dep.planId))}
                        disabled={loading[`renew-${dep.id}`] || isPaused}
                        className="flex items-center gap-1 bg-accent-blue/10 text-accent-blue px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-accent-blue/20 transition disabled:opacity-50"
                      >
                        {loading[`renew-${dep.id}`] ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                        Renew
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => doAction(`early-${dep.id}`, () => onEarlyWithdraw(dep.id))}
                      disabled={loading[`early-${dep.id}`] || isPaused}
                      className="flex items-center gap-1 bg-danger/10 text-danger px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-danger/20 transition disabled:opacity-50"
                    >
                      {loading[`early-${dep.id}`] ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                      Early Withdraw
                    </button>
                  )}
                  {isPaused && (
                    <span className="text-xs text-danger flex items-center gap-1 ml-1">
                      <Ban size={12} /> Paused
                    </span>
                  )}
                  {matured && vaultNum < Number(formatAmount(interest)) && !isPaused && (
                    <span className="text-xs text-yellow-400 flex items-center gap-1 ml-1">
                      Vault insufficient
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          </div>
          </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-text-secondary mb-3 uppercase tracking-wide">History ({history.length})</h3>
              <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg-primary border-b border-border text-text-secondary text-xs uppercase">
                        <th className="text-left px-4 py-3">ID</th>
                        <th className="text-left px-4 py-3">Plan</th>
                        <th className="text-left px-4 py-3">Principal</th>
                        <th className="text-left px-4 py-3">Interest</th>
                        <th className="text-left px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((dep) => {
                        const interest = minterest(dep.principal, dep.aprBpsAtOpen, dep.tenorDays);
                        return (
                          <tr key={dep.id} className="border-b border-border last:border-0 hover:bg-bg-hover transition">
                            <td className="px-4 py-3 font-mono">#{dep.id}</td>
                            <td className="px-4 py-3">{dep.planId}</td>
                            <td className="px-4 py-3 font-mono">{formatAmount(dep.principal)} mUSDC</td>
                            <td className="px-4 py-3 font-mono text-accent">{formatAmount(interest)} mUSDC</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                dep.status === 1 ? "bg-text-secondary/10 text-text-secondary" :
                                dep.status === 2 ? "bg-accent-blue/10 text-accent-blue" :
                                "bg-accent-purple/10 text-accent-purple"
                              }`}>
                                {statusLabel(dep.status)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
