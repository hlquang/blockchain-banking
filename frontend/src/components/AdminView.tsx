import { useState } from "react";
import { Settings, PlusCircle, Database, Coins, Loader2, Eye, EyeOff } from "lucide-react";
import type { SavingPlan, Deposit } from "../types";
import { aprPercent, formatAmount, statusLabel } from "../utils/helpers";

interface AdminViewProps {
  plans: SavingPlan[];
  vaultBalance: string;
  vaultBalanceBig: bigint;
  isPaused: boolean;
  allDeposits: Deposit[];
  onCreatePlan: (min: bigint, max: bigint, tenor: number, apr: number, penalty: number) => Promise<void>;
  onUpdatePlan: (id: number, newApr: number) => Promise<void>;
  onEnablePlan: (id: number) => Promise<void>;
  onDisablePlan: (id: number) => Promise<void>;
  onFundVault: (amount: string) => Promise<void>;
  onWithdrawVault: (amount: string) => Promise<void>;
  onPause: () => Promise<void>;
  onUnpause: () => Promise<void>;
  onSetFeeReceiver: (address: string) => Promise<void>;
}

export default function AdminView({
  plans, vaultBalance, isPaused, allDeposits, onCreatePlan, onUpdatePlan, onEnablePlan, onDisablePlan, onFundVault, onWithdrawVault, onPause, onUnpause, onSetFeeReceiver,
}: AdminViewProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [planForm, setPlanForm] = useState({ min: "10", max: "10000", tenor: "90", apr: "400", penalty: "100" });
  const [vaultAmount, setVaultAmount] = useState("50000");
  const [feeReceiver, setFeeReceiver] = useState("");
  const [showDeposits, setShowDeposits] = useState(false);

  const doAction = async (key: string, fn: () => Promise<void>) => {
    setLoading((s) => ({ ...s, [key]: true }));
    try { await fn(); } finally { setLoading((s) => ({ ...s, [key]: false })); }
  };

  const handleCreatePlan = () => {
    const parse6 = (v: string) => BigInt(Math.round(parseFloat(v) * 10 ** 6));
    const min = parse6(planForm.min);
    const max = parse6(planForm.max);
    const tenor = parseInt(planForm.tenor);
    const apr = parseInt(planForm.apr);
    const penalty = parseInt(planForm.penalty);
    if (isNaN(tenor) || isNaN(apr) || isNaN(penalty) || min >= max) return;
    doAction("create-plan", () => onCreatePlan(min, max, tenor, apr, penalty));
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <Settings size={20} /> Admin Panel
      </h2>

      {/* Vault Info */}
      <div className="bg-bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-accent" />
            <span className="text-sm text-text-secondary">Vault Balance:</span>
            <span className="font-mono font-medium">{vaultBalance} mUSDC</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={vaultAmount}
            onChange={(e) => setVaultAmount(e.target.value)}
            className="w-28 bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
            placeholder="Amount"
          />
          <button
            onClick={() => doAction("fund", () => onFundVault(vaultAmount))}
            disabled={loading["fund"]}
            className="flex items-center gap-1 bg-accent/10 text-accent px-3 py-1.5 rounded-lg text-sm hover:bg-accent/20 transition disabled:opacity-50"
          >
            {loading["fund"] ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
            Fund
          </button>
          <button
            onClick={() => doAction("withdraw", () => onWithdrawVault(vaultAmount))}
            disabled={loading["withdraw"]}
            className="flex items-center gap-1 bg-danger/10 text-danger px-3 py-1.5 rounded-lg text-sm hover:bg-danger/20 transition disabled:opacity-50"
          >
            {loading["withdraw"] ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            Withdraw
          </button>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-bg-card border border-border rounded-xl p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isPaused ? "bg-danger" : "bg-accent"}`} />
          <span className="text-sm font-medium">System Status</span>
          <span className={`text-sm px-2 py-0.5 rounded-full ${isPaused ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`}>
            {isPaused ? "Paused" : "Active"}
          </span>
        </div>
        <button
          onClick={() => doAction(isPaused ? "unpause" : "pause", isPaused ? onUnpause : onPause)}
          disabled={loading["pause"] || loading["unpause"]}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
            isPaused
              ? "bg-accent text-white hover:bg-accent-hover"
              : "bg-danger/10 text-danger hover:bg-danger/20"
          }`}
        >
          {loading["pause"] || loading["unpause"] ? <Loader2 size={14} className="animate-spin" /> : null}
          {isPaused ? "Unpause System" : "Pause System"}
        </button>
      </div>

      {/* Fee Receiver */}
      <div className="bg-bg-card border border-border rounded-xl p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm text-text-secondary whitespace-nowrap">Fee Receiver:</span>
          <input
            type="text"
            value={feeReceiver}
            onChange={(e) => setFeeReceiver(e.target.value)}
            placeholder="0x..."
            className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary font-mono outline-none focus:border-accent"
          />
          <button
            onClick={() => doAction("fee-receiver", () => onSetFeeReceiver(feeReceiver))}
            disabled={loading["fee-receiver"] || !feeReceiver}
            className="flex items-center gap-1 bg-accent/10 text-accent px-3 py-1.5 rounded-lg text-sm hover:bg-accent/20 transition disabled:opacity-50 whitespace-nowrap"
          >
            {loading["fee-receiver"] ? <Loader2 size={14} className="animate-spin" /> : null}
            Set Fee Receiver
          </button>
        </div>
      </div>

      {/* Create Plan Form */}
      <div className="bg-bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <PlusCircle size={18} className="text-accent" />
          <span className="font-semibold">Create New Plan</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
          {(["min", "max", "tenor", "apr", "penalty"] as const).map((f) => (
            <div key={f}>
              <label className="text-xs text-text-secondary block mb-1">
                {f === "min" ? "Min Amount" : f === "max" ? "Max Amount" : f === "tenor" ? "Tenor (days)" : f === "apr" ? "APR (bps)" : "Penalty (bps)"}
              </label>
              <input
                type="number"
                value={planForm[f]}
                onChange={(e) => setPlanForm((s) => ({ ...s, [f]: e.target.value }))}
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleCreatePlan}
          disabled={loading["create-plan"]}
          className="flex items-center gap-1 bg-accent px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50"
        >
          {loading["create-plan"] ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
          Create Plan
        </button>
      </div>

      {/* Existing Plans */}
      <h3 className="font-semibold mb-3">Existing Plans ({plans.length})</h3>
      <div className="space-y-3">
        {plans.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-xl p-6 text-center text-text-secondary text-sm">
            No plans yet. Create one above.
          </div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="bg-bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${plan.enabled ? "bg-accent" : "bg-danger"}`} />
                <div>
                  <span className="font-medium">Plan #{plan.id}</span>
                  <span className="text-text-secondary text-sm ml-3">
                    {plan.tenorDays}d · {aprPercent(plan.aprBps)} · {formatAmount(plan.minAmount)}–{formatAmount(plan.maxAmount)} mUSDC
                  </span>
                  <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${plan.enabled ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"}`}>
                    {plan.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  defaultValue={plan.aprBps}
                  className="w-20 bg-bg-primary border border-border rounded-lg px-2 py-1 text-sm text-text-primary outline-none focus:border-accent"
                  id={`apr-${plan.id}`}
                />
                <button
                  onClick={() => {
                    const el = document.getElementById(`apr-${plan.id}`) as HTMLInputElement;
                    const v = parseInt(el.value);
                    if (!isNaN(v)) doAction(`update-${plan.id}`, () => onUpdatePlan(plan.id, v));
                  }}
                  disabled={loading[`update-${plan.id}`]}
                  className="bg-accent-blue/10 text-accent-blue px-2 py-1 rounded-lg text-xs hover:bg-accent-blue/20 transition disabled:opacity-50"
                >
                  {loading[`update-${plan.id}`] ? "..." : "Update APR"}
                </button>
                <button
                  onClick={() => doAction(plan.enabled ? `disable-${plan.id}` : `enable-${plan.id}`, () => plan.enabled ? onDisablePlan(plan.id) : onEnablePlan(plan.id))}
                  disabled={loading[plan.enabled ? `disable-${plan.id}` : `enable-${plan.id}`]}
                  className={`px-2 py-1 rounded-lg text-xs transition disabled:opacity-50 ${
                    plan.enabled
                      ? "bg-danger/10 text-danger hover:bg-danger/20"
                      : "bg-accent/10 text-accent hover:bg-accent/20"
                  }`}
                >
                  {plan.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* All Deposits */}
      <div className="mt-6">
        <button
          onClick={() => setShowDeposits(!showDeposits)}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition mb-3"
        >
          {showDeposits ? <EyeOff size={18} /> : <Eye size={18} />}
          <span className="font-semibold">All Deposits ({allDeposits.length})</span>
        </button>

        {showDeposits && (
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            {allDeposits.length === 0 ? (
              <div className="p-6 text-center text-text-secondary text-sm">No deposits yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-primary border-b border-border text-text-secondary text-xs uppercase">
                      <th className="text-left px-4 py-3">ID</th>
                      <th className="text-left px-4 py-3">Owner</th>
                      <th className="text-left px-4 py-3">Plan</th>
                      <th className="text-left px-4 py-3">Principal</th>
                      <th className="text-left px-4 py-3">APR</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDeposits.map((dep) => (
                      <tr key={dep.id} className="border-b border-border last:border-0 hover:bg-bg-hover transition">
                        <td className="px-4 py-3 font-mono">#{dep.id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                          {dep.owner.slice(0, 6)}...{dep.owner.slice(-4)}
                        </td>
                        <td className="px-4 py-3 font-mono">{formatAmount(dep.principal)} mUSDC</td>
                        <td className="px-4 py-3">{aprPercent(dep.aprBpsAtOpen)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            dep.status === 0 ? "bg-accent/10 text-accent" :
                            dep.status === 1 ? "bg-text-secondary/10 text-text-secondary" :
                            "bg-accent-blue/10 text-accent-blue"
                          }`}>
                            {statusLabel(dep.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
