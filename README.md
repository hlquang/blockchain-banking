# BCBanking: Blockchain Banking System

A blockchain-based term deposit system built for EVM-compatible blockchains (Ethereum, Sepolia, etc.). Users lock tokens in saving plans, earn interest, and withdraw at maturity. The system uses ERC721 NFTs as deposit certificates and a dedicated vault for interest payments. Includes a standalone auto-renew bot.

## Table of Contents

1. [Features](#1-features)
2. [Project Structure](#2-project-structure)
3. [System Architecture](#3-system-architecture)
4. [Smart Contracts](#4-smart-contracts)
5. [Business Rules](#5-business-rules)
6. [Test Coverage (29 tests)](#6-test-coverage-29-tests)
7. [Local Setup](#7-local-setup)
8. [Tech Stack](#8-tech-stack)

## 1. Features

### User (Depositor)
- View available saving plans
- Open a deposit (approve + deposit flow)
- Withdraw at maturity (principal + interest)
- Early withdraw (principal - penalty, zero interest)
- Manual renew (interest compounded into new principal)
- Auto renew (bot triggers after 3-day grace period)
- View deposit history (past certificates with status)

### Admin
- Create saving plans (tenor, APR, penalty, min/max limits)
- Update plan APR
- Enable/disable plans
- Fund vault (deposit tokens for interest payments)
- Withdraw from vault
- Set fee receiver address (receives early withdrawal penalties)
- Pause/unpause system (emergency stop)
- View all deposits across all users

### Bot
- Standalone script that polls every 30 seconds
- Automatically renews matured deposits past grace period
- No MetaMask required - signs transactions via private key

## 2. Project Structure

```
root/
├── contracts/
│   ├── MockUSDC.sol            ERC20 test token, 6 decimals
│   ├── VaultManager.sol        Interest vault + admin controls
│   └── SavingCore.sol          Plans, deposits, ERC721 NFTs
├── deploy/
│   ├── 1-deploy-mockusdc.ts    Deployment order: MockUSDC first
│   ├── 2-deploy-vaultmanager.ts
│   └── 3-deploy-savingcore.ts
├── test/
│   ├── mockusdc-vault.test.ts  MockUSDC + VaultManager tests (12)
│   └── saving.test.ts          SavingCore tests (17)
├── scripts/
│   └── bot.ts                  Auto-renew bot (30s interval)
├── frontend/
│   ├── src/
│   │   ├── components/         Navbar, PlansView, DepositsView, AdminView
│   │   ├── hooks/              useWeb3, useBanking
│   │   ├── config/             Contract ABIs + addresses
│   │   └── utils/              Formatting helpers
│   └── package.json
├── .env-example                Template for environment variables
├── .gitignore
├── hardhat.config.ts
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

## 3. System Architecture

![System Architecture](assets/swimlane_diagram.png)

**Flow descriptions:**

1. **Open Deposit** - User approves tokens, calls `openDeposit()`. Contract checks plan is enabled and amount is within limits, transfers tokens, mints an ERC721 NFT.
2. **Withdraw at Maturity** - User calls `withdrawAtMaturity()` after `maturityAt`. Contract calculates simple interest, pulls interest from VaultManager, returns principal + interest to user.
3. **Early Withdraw** - User calls `earlyWithdraw()` before maturity. Zero interest earned. Penalty deducted and sent to feeReceiver. Net principal returned to user.
4. **Manual Renew** - User calls `renewDeposit()` on or after maturity. Interest pulled from VaultManager and compounded into new principal. New NFT minted with new plan's rate.
5. **Auto Renew** - Bot script polls `totalDeposits()` every 30 seconds. If deposit is past `maturityAt + 3 days` with Active status, calls `autoRenewDeposit()` with original APR preserved.

## 4. Smart Contracts

| Contract | File | Key Functions |
|----------|------|---------------|
| MockUSDC | `contracts/MockUSDC.sol` | `mint(to, amount)` - create test tokens for testing, 6 decimals |
| VaultManager | `contracts/VaultManager.sol` | `fundVault`, `withdrawVault`, `payInterest`, `setFeeReceiver`, `pause`, `unpause` |
| SavingCore | `contracts/SavingCore.sol` | `createPlan`, `updatePlan`, `enablePlan`, `disablePlan`, `openDeposit`, `withdrawAtMaturity`, `earlyWithdraw`, `renewDeposit`, `autoRenewDeposit` |

## 5. Business Rules

These rules hold at all times:

1. **APR and penalty are snapshotted** at deposit open. Admin changes to a plan never affect existing deposits.
2. **Interest uses simple interest only** - no compounding within a single deposit term.
3. **Early withdrawal gives zero interest.** Penalty goes to feeReceiver.
4. **Auto-renew preserves the original APR**, protecting the user from rate decreases.
5. **Interest is always paid from the vault.** If the vault has insufficient funds, the withdrawal must revert.
6. **When paused, no withdrawals or renewals are allowed** (emergency protection).
7. **Admin cannot alter a deposit that is already open.**

### Interest Formula

```
interest = (principal x aprBpsAtOpen x tenorDays) / (365 x 10,000)
```

**Example:** 1,000 USDC deposited for 90 days at 2.5% APR (250 bps):
```
interest = (1,000 x 250 x 90) / (365 x 10,000) = 6.16 USDC
```

### Penalty Formula

```
penalty = (principal x penaltyBpsAtOpen) / 10,000
user receives = principal - penalty
penalty goes to feeReceiver
```

**Example:** 1,000 USDC withdrawn early with 5% penalty (500 bps):
```
penalty = (1,000 x 500) / 10,000 = 50 USDC
user receives = 1,000 - 50 = 950 USDC
```

## 6. Test Coverage (29 Tests)

### Group Overview

| Test Group | Tests | Required Cases Covered |
|------------|-------|------------------------|
| createPlan | 4 | Valid plan, invalid APR, update APR, enable/disable |
| openDeposit | 4 | Happy path, below min, above max, disabled plan |
| withdrawAtMaturity | 3 | Correct interest, too early, already withdrawn |
| earlyWithdraw | 2 | Correct penalty + feeReceiver, zero interest paid |
| renewDeposit | 2 | Correct new principal, status update to ManualRenewed |
| autoRenewDeposit | 2 | Before grace period (revert), after grace + APR preserved |
| Vault | 3 | Fund, withdraw, insufficient vault for interest payout |
| Pause | 2 | Pause/unpause, operations blocked when paused |
| **Total** | **22** | **All 21 required cases from Section 7.2** |

## 7. Local Setup

### Prerequisites
- Node.js 18+
- MetaMask browser extension

### Installation

```bash
git clone <repository-url>
cd <repository>
npm install
cd frontend && npm install && cd ..

# Copy and configure environment variables
cp .env-example .env
# Edit .env with your BOT_PRIVATE_KEY (use Account #0 key for local testing)
```

### Run the System (3 Terminals)

**Terminal 1 — Hardhat Node** (starts local blockchain + auto-deploys contracts):

```bash
npx hardhat node
```

Wait for output showing "deployed at" addresses for all 3 contracts (MockUSDC, VaultManager, SavingCore). This confirms deployment succeeded.

**Terminal 2 — Frontend**:

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 in your browser.

**Terminal 3 — Auto-Renew Bot**:

```bash
npm run bot
```

The bot polls every 30 seconds and automatically renews deposits past their grace period.

### MetaMask Setup

1. Open MetaMask -> Settings -> Networks -> Add Network
2. **Network Name:** `Hardhat Local`
3. **RPC URL:** `http://127.0.0.1:8545`
4. **Chain ID:** `31337`
5. **Currency Symbol:** `ETH`
6. Save and switch to this network

### Import Test Accounts

**Admin Account** (Account #0 - has 10,000 ETH on Hardhat):
```
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

**User Account** (Account #1 - has 10,000 ETH on Hardhat):
```
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

To import: MetaMask -> Account icon -> Import Account -> paste private key.

### Demo

Watch the demo video: [BCBanking Demo](https://youtu.be/iMO0wjUA0KE)

This video walks through all features including admin setup, user deposits, withdrawals, renewals, pause/unpause, and the auto-renew bot.

### Fast-Forwarding Time (For Demo)

Open the browser console (F12) and run these commands:

```javascript
// Step 1: Fast-forward time (e.g. 93 days = 90 maturity + 3 day grace)
await fetch("http://127.0.0.1:8545", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0", id: 1,
    method: "evm_increaseTime",
    params: [93 * 86400]
  })
});

// Step 2: Mine a block to apply the time change
await fetch("http://127.0.0.1:8545", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0", id: 2,
    method: "evm_mine",
    params: []
  })
});

// Step 3: Refresh the page
location.reload();
```

### Running Tests

```bash
# Run all 29 tests
npm test
```

## 8. Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Solidity | 0.8.28 | Smart contract language |
| Hardhat | 2.25.x | Development framework |
| ethers.js | 6.13.x | Ethereum interaction |
| OpenZeppelin | 5.1.x | ERC721, Ownable, Pausable |
| React | 19.x | Frontend UI |
| Vite | 8.x | Frontend build tool |
| Tailwind CSS | 4.x | Styling |
| TypeChain | 9.x | Type-safe contract bindings |
