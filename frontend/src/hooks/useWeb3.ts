import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, JsonRpcSigner, Contract } from "ethers";
import { CONTRACT_ADDRESSES, NETWORK_CONFIG } from "../config/contracts";
import MockUSDCABI from "../config/MockUSDC.abi.json";
import VaultManagerABI from "../config/VaultManager.abi.json";
import SavingCoreABI from "../config/SavingCore.abi.json";

export interface Web3State {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  account: string | null;
  chainId: number | null;
  mockUSDC: Contract | null;
  vaultManager: Contract | null;
  savingCore: Contract | null;
  isConnecting: boolean;
  error: string | null;
}

export function useWeb3() {
  const [state, setState] = useState<Web3State>({
    provider: null,
    signer: null,
    account: null,
    chainId: null,
    mockUSDC: null,
    vaultManager: null,
    savingCore: null,
    isConnecting: false,
    error: null,
  });

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState((s) => ({ ...s, error: "Please install MetaMask" }));
      return;
    }
    setState((s) => ({ ...s, isConnecting: true, error: null }));
    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      const signer = await provider.getSigner();

      const mockUSDC = new Contract(CONTRACT_ADDRESSES.mockUSDC, MockUSDCABI, signer);
      const vaultManager = new Contract(CONTRACT_ADDRESSES.vaultManager, VaultManagerABI, signer);
      const savingCore = new Contract(CONTRACT_ADDRESSES.savingCore, SavingCoreABI, signer);

      setState({
        provider,
        signer,
        account: accounts[0],
        chainId: Number(network.chainId),
        mockUSDC,
        vaultManager,
        savingCore,
        isConnecting: false,
        error: null,
      });
    } catch (err: any) {
      setState((s) => ({ ...s, isConnecting: false, error: err.message || "Connection failed" }));
    }
  }, []);

  const switchToHardhat = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7A69" }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [NETWORK_CONFIG],
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setState((s) => ({ ...s, account: null, signer: null }));
      } else {
        connect();
      }
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, [connect]);

  return { ...state, connect, switchToHardhat };
}
