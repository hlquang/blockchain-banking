// Local Hardhat deployment addresses
// When running `npx hardhat node` + `npx hardhat deploy`
export const CONTRACT_ADDRESSES = {
  mockUSDC: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  vaultManager: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  savingCore: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
};

export const NETWORK_CONFIG = {
  chainId: 31337, // Hardhat
  chainName: "Hardhat Local",
  rpcUrl: "http://127.0.0.1:8545",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
};

export const MINT_AMOUNT = "1000"; // USDC amount for faucet
export const FAUCET_AMOUNT = BigInt(1000) * BigInt(10 ** 6); // 1000 USDC in 6 decimals
