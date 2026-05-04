import { useEffect, useState, useCallback } from "react";
import { WalletCards, ScrollText, Settings, Shield, RefreshCw, Ban, TriangleAlert } from "lucide-react";
import Navbar from "./components/Navbar";
import PlansView from "./components/PlansView";
import DepositsView from "./components/DepositsView";
import AdminView from "./components/AdminView";
import { useWeb3 } from "./hooks/useWeb3";
import { useBanking } from "./hooks/useBanking";
import type { SavingPlan, Deposit } from "./types";

const OWNER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const HARDHAT_CHAIN_ID = 31337;

type Tab = "plans" | "deposits" | "admin";

export default function App() {
  const { account, isConnecting, error, chainId, mockUSDC, vaultManager, savingCore, connect, switchToHardhat } = useWeb3();
  const {
    getBalance, getVaultBalance, getPlans, getUserDeposits, getAllDeposits,
    getIsPaused, getCurrentTimestamp, getFaucet,
    openDeposit, withdraw, earlyWithdraw, renewDeposit,
    createPlan, updatePlan, enablePlan, disablePlan,
    fundVault, withdrawVault,
    pauseSystem, unpauseSystem,
  } = useBanking(mockUSDC, vaultManager, savingCore, account);

  const [balance, setBalance] = useState("0");
  const [vaultBalance, setVaultBalance] = useState("0");
  const [plans, setPlans] = useState<SavingPlan[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("plans");
  const [refreshing, setRefreshing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [blockTimestamp, setBlockTimestamp] = useState(0);
  const [allDeposits, setAllDeposits] = useState<Deposit[]>([]);
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  const isOwner = account?.toLowerCase() === OWNER_ADDRESS.toLowerCase();
  const wrongNetwork = account && chainId !== null && chainId !== HARDHAT_CHAIN_ID;

  const notify = useCallback((msg: string, type: "success" | "error" | "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 6000);
  }, []);

  const refresh = useCallback(async () => {
    if (!account) return;
    setRefreshing(true);
    try {
      const [bal, vb, p, d, paused, ts, ad] = await Promise.all([
        getBalance(),
        getVaultBalance(),
        getPlans(),
        getUserDeposits(),
        getIsPaused(),
        getCurrentTimestamp(),
        getAllDeposits(),
      ]);
      setBalance(bal);
      setVaultBalance(vb);
      setPlans(p);
      setDeposits(d);
      setIsPaused(paused);
      setBlockTimestamp(ts);
      setAllDeposits(ad);
    } catch {
      notify("Failed to refresh data", "error");
    } finally {
      setRefreshing(false);
    }
  }, [account, getBalance, getVaultBalance, getPlans, getUserDeposits, getIsPaused, getCurrentTimestamp, getAllDeposits, notify]);

  useEffect(() => {
    if (account) refresh();
  }, [account, refresh]);

  const safeAction = useCallback(async (label: string, fn: () => Promise<void>) => {
    try {
      await fn();
      await refresh();
      notify(`${label} successful`, "success");
    } catch (err: any) {
      const msg = err?.reason || err?.message || "Transaction failed";
      notify(`Failed: ${msg}`, "error");
    }
  }, [refresh, notify]);

  const handleDeposit = useCallback(async (planId: number, amount: string) => {
    await safeAction("Deposit", () => openDeposit(planId, amount));
  }, [safeAction, openDeposit]);

  const handleWithdraw = useCallback(async (id: number) => {
    await safeAction("Withdrawal", () => withdraw(id));
  }, [safeAction, withdraw]);

  const handleEarlyWithdraw = useCallback(async (id: number) => {
    await safeAction("Early withdrawal", () => earlyWithdraw(id));
  }, [safeAction, earlyWithdraw]);

  const handleRenew = useCallback(async (id: number, newPlanId: number) => {
    await safeAction("Renewal", () => renewDeposit(id, newPlanId));
  }, [safeAction, renewDeposit]);

  const handleCreatePlan = useCallback(async (min: bigint, max: bigint, tenor: number, apr: number, penalty: number) => {
    await safeAction("Plan creation", () => createPlan(min, max, tenor, apr, penalty));
  }, [safeAction, createPlan]);

  const handleUpdatePlan = useCallback(async (id: number, newApr: number) => {
    await safeAction("Plan update", () => updatePlan(id, newApr));
  }, [safeAction, updatePlan]);

  const handleEnablePlan = useCallback(async (id: number) => {
    await safeAction("Plan enabled", () => enablePlan(id));
  }, [safeAction, enablePlan]);

  const handleDisablePlan = useCallback(async (id: number) => {
    await safeAction("Plan disabled", () => disablePlan(id));
  }, [safeAction, disablePlan]);

  const handleFundVault = useCallback(async (amount: string) => {
    await safeAction("Vault funded", () => fundVault(amount));
  }, [safeAction, fundVault]);

  const handleWithdrawVault = useCallback(async (amount: string) => {
    await safeAction("Vault withdrawn", () => withdrawVault(amount));
  }, [safeAction, withdrawVault]);

  const handlePause = useCallback(async () => {
    await safeAction("System paused", () => pauseSystem());
  }, [safeAction, pauseSystem]);

  const handleUnpause = useCallback(async () => {
    await safeAction("System unpaused", () => unpauseSystem());
  }, [safeAction, unpauseSystem]);

  const tabs = [
    { key: "plans" as const, label: "Saving Plans", icon: WalletCards },
    { key: "deposits" as const, label: "My Certificates", icon: ScrollText, count: deposits.filter((d) => d.status === 0).length },
    ...(isOwner ? [{ key: "admin" as const, label: "Admin", icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar
        account={account}
        balance={balance}
        isConnecting={isConnecting}
        error={error}
        onConnect={connect}
        onSwitch={switchToHardhat}
        onFaucet={getFaucet}
      />

      {wrongNetwork && (
        <div className="bg-danger/10 border-b border-danger/30 px-6 py-2 flex items-center justify-center gap-2 text-sm text-danger">
          <TriangleAlert size={16} />
          Wrong network — please switch to Hardhat Local (chain ID 31337)
          <button
            onClick={switchToHardhat}
            className="underline hover:no-underline ml-2"
          >
            Switch now
          </button>
        </div>
      )}

      {isPaused && (
        <div className="bg-danger/10 border-b border-danger/30 px-6 py-2 flex items-center justify-center gap-2 text-sm text-danger">
          <Ban size={16} />
          System is paused by admin — no deposits, withdrawals, or renewals allowed
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8">
        {!account ? (
          <div className="bg-bg-card border border-border rounded-xl p-12 text-center max-w-md mx-auto mt-16">
            <Shield size={64} className="mx-auto text-text-secondary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome to BCBanking</h2>
            <p className="text-text-secondary mb-6">Connect your wallet to start earning interest on your deposits.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "bg-accent text-white"
                      : "text-text-secondary hover:bg-bg-hover"
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.key ? "bg-white/20" : "bg-bg-hover"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={refresh}
                disabled={refreshing}
                className="ml-auto text-text-secondary hover:text-text-primary p-2 rounded-lg hover:bg-bg-hover transition"
              >
                <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>

            {notification && (
              <div className={`px-4 py-2 rounded-lg mb-4 text-sm border ${
                notification.type === "success"
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : notification.type === "error"
                  ? "bg-danger/10 border-danger/30 text-danger"
                  : "bg-accent-blue/10 border-accent-blue/30 text-accent-blue"
              }`}>
                {notification.msg}
              </div>
            )}

            {activeTab === "plans" && (
              <PlansView plans={plans} userBalance={balance} isPaused={isPaused} onDeposit={handleDeposit} />
            )}
            {activeTab === "deposits" && (
              <DepositsView
                deposits={deposits}
                vaultBalance={vaultBalance}
                isPaused={isPaused}
                blockTimestamp={blockTimestamp}
                onWithdraw={handleWithdraw}
                onEarlyWithdraw={handleEarlyWithdraw}
                onRenew={handleRenew}
              />
            )}
            {activeTab === "admin" && (
              <AdminView
                plans={plans}
                vaultBalance={vaultBalance}
                vaultBalanceBig={BigInt(0)}
                isPaused={isPaused}
                allDeposits={allDeposits}
                onCreatePlan={handleCreatePlan}
                onUpdatePlan={handleUpdatePlan}
                onEnablePlan={handleEnablePlan}
                onDisablePlan={handleDisablePlan}
                onFundVault={handleFundVault}
                onWithdrawVault={handleWithdrawVault}
                onPause={handlePause}
                onUnpause={handleUnpause}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
