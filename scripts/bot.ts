import { ethers } from "hardhat";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

const RPC_URL = "http://127.0.0.1:8545";
const POLL_INTERVAL = 30000; // 30 seconds
const THREE_DAYS = 3 * 86400;

// Local Hardhat deployment addresses (standard nonce order)
const MOCK_USDC = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const VAULT_MANAGER = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const SAVING_CORE = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

const SAVING_CORE_ABI = [
  "function totalDeposits() view returns (uint256)",
  "function getDeposit(uint256) view returns (uint256 planId, uint256 principal, uint256 tenorDays, uint256 aprBpsAtOpen, uint256 penaltyBpsAtOpen, uint256 startAt, uint256 maturityAt, uint8 status)",
  "function autoRenewDeposit(uint256 depositId)",
  "function ownerOf(uint256) view returns (address)",
];

async function main() {
  const privateKey = process.env.BOT_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ BOT_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(privateKey, provider);
  const savingCore = new Contract(SAVING_CORE, SAVING_CORE_ABI, wallet);

  console.log(`🤖 Auto-renew bot started`);
  console.log(`   Wallet: ${wallet.address}`);
  console.log(`   Network: ${RPC_URL}`);
  console.log(`   Interval: ${POLL_INTERVAL / 1000}s\n`);

  const poll = async () => {
    try {
      const total = Number(await savingCore.totalDeposits());
      if (total === 0) return;

      const now = Number(await provider.getBlock("latest").then((b) => b.timestamp));
      let renewed = 0;

      for (let i = 0; i < total; i++) {
        try {
          const deposit = await savingCore.getDeposit(i);
          const status = Number(deposit.status);
          const maturityAt = Number(deposit.maturityAt);
          const owner = await savingCore.ownerOf(i);

          if (status === 0 && now > maturityAt + THREE_DAYS) {
            console.log(`   Auto-renewing Certificate #${i} (owner: ${owner.slice(0, 6)}...)`);
            const tx = await savingCore.autoRenewDeposit(i);
            await tx.wait();
            console.log(`   ✅ Certificate #${i} renewed (tx: ${tx.hash.slice(0, 10)}...)`);
            renewed++;
          }
        } catch (err) {
          // deposit not accessible, skip
        }
      }

      const timestamp = new Date().toISOString().slice(11, 19);
      if (renewed > 0) {
        console.log(`[${timestamp}] ✅ Renewed ${renewed} certificate(s)\n`);
      }
    } catch (err: any) {
      const timestamp = new Date().toISOString().slice(11, 19);
      console.error(`[${timestamp}] ⚠️ Poll error: ${err.message}`);
    }
  };

  // Run immediately, then every interval
  await poll();
  setInterval(poll, POLL_INTERVAL);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
