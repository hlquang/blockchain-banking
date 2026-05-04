import { Wallet, RefreshCw, Coins } from "lucide-react";
import { useState } from "react";

interface NavbarProps {
  account: string | null;
  balance: string;
  isConnecting: boolean;
  error: string | null;
  onConnect: () => void;
  onSwitch: () => void;
  onFaucet: (amount: string) => Promise<void>;
}

export default function Navbar({ account, balance, isConnecting, error, onConnect, onSwitch, onFaucet }: NavbarProps) {
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetAmount, setFaucetAmount] = useState("1000");

  const handleFaucet = async () => {
    const amt = faucetAmount.trim();
    if (!amt || parseFloat(amt) <= 0) return;
    setFaucetLoading(true);
    try {
      await onFaucet(amt);
    } finally {
      setFaucetLoading(false);
    }
  };

  return (
    <nav className="bg-bg-secondary border-b border-border px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-sm font-bold">B</div>
        <span className="text-lg font-semibold">BCBanking</span>
        <span className="text-xs text-text-secondary ml-2">Term Deposit System</span>
      </div>

      <div className="flex items-center gap-3">
        {error && <span className="text-danger text-xs">{error}</span>}
        {account && (
          <span className="text-text-secondary text-sm">
            <span className="text-accent font-medium">{balance}</span> mUSDC
          </span>
        )}
        {account && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={faucetAmount}
              onChange={(e) => setFaucetAmount(e.target.value)}
              className="w-24 bg-bg-primary border border-border rounded-lg px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
              placeholder="Amount"
            />
            <button
              onClick={handleFaucet}
              disabled={faucetLoading}
              className="flex items-center gap-1 bg-accent/10 text-accent px-3 py-1.5 rounded-lg text-sm hover:bg-accent/20 transition disabled:opacity-50"
            >
              <Coins size={16} />
              {faucetLoading ? "Minting..." : "Mint"}
            </button>
          </div>
        )}
        {account ? (
          <button
            onClick={onSwitch}
            className="flex items-center gap-1.5 bg-bg-hover px-3 py-1.5 rounded-lg text-sm hover:bg-border transition"
          >
            <Wallet size={16} />
            {account.slice(0, 6)}...{account.slice(-4)}
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="flex items-center gap-1.5 bg-accent px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-hover transition disabled:opacity-50"
          >
            {isConnecting ? <RefreshCw size={16} className="animate-spin" /> : <Wallet size={16} />}
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </nav>
  );
}
