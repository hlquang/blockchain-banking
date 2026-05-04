# BCBanking: Blockchain Banking System

A blockchain-based term deposit system built on Ethereum. Users lock tokens in saving plans, earn interest, and withdraw at maturity. The system uses ERC721 NFTs as deposit certificates and a dedicated vault for interest payments. Includes a standalone auto-renew bot.

## Table of Contents

1. [Features](#1-features)
2. [Project Structure](#2-project-structure)
3. [System Architecture](#3-system-architecture)
4. [Smart Contracts](#4-smart-contracts)
5. [Business Rules](#5-business-rules)
6. [Test Coverage (29 tests)](#6-test-coverage-29-tests)
7. [Local Setup](#7-local-setup)
8. [Tech Stack](#8-tech-stack)
9. [License](#9-license)

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

```
                           BCBanking System

┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│     User                    SavingCore            VaultManager      │
│  (Depositor)                (ERC721 NFT)          (Interest Pool)   │
│                                                                     │
│       │                        │                       │            │
│       │  ① openDeposit()      │                       │            │
│       ├───────────────────────►│                       │            │
│       │   approve + transfer  │   holds principal     │            │
│       │   mUSDC to contract   │   mints NFT           │            │
│       │                       │                       │            │
│       │  ② withdrawAtMaturity │                       │            │
│       ├───────────────────────►│                       │            │
│       │                       │   payInterest() ──────►│            │
│       │◄── principal + int. ──┤◄───────────────────────┤            │
│       │                       │                       │            │
│       │  ③ earlyWithdraw()   │                       │            │
│       ├───────────────────────►│                       │            │
│       │◄─ principal - penalty │  transfer penalty ───►│ feeRecv    │
│       │                       │                       │            │
│       │  ④ renewDeposit()    │                       │            │
│       ├───────────────────────►│                       │            │
│       │                       │  payInterest(this) ──►│            │
│       │   new cert minted     │  interest compounded  │            │
│       │                       │                       │            │
│       │  ⑤ autoRenew          │                       │            │
│       │  Bot (30s) ──────────►│  (same as renew)      │            │
│       │                       │                       │            │
├───────┴───────────────────────┴───────────────────────┴────────────┤
│                                                                     │
│   Admin (Owner)                                                     │
│       │                                                             │
│       ├──► createPlan / updatePlan / enablePlan / disablePlan        │
│       ├──► fundVault / withdrawVault                                 │
│       ├──► setFeeReceiver                                            │
│       └──► pause / unpause                                           │
└─────────────────────────────────────────────────────────────────────┘
```

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

These rules (from `final_assignment.txt` Section 6) hold at all times:

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

Plus 7 additional MockUSDC and VaultManager unit tests (`mockusdc-vault.test.ts`).

### Test Details

#### createPlan (4 tests)

| Test | Logic |
|------|-------|
| Valid plan | Calls `createPlan` with min=10, max=10000, tenor=90, apr=400 (4%), penalty=100 (1%). Verifies `PlanCreated` event emits with correct args and plan fields match input. |
| Invalid APR > 100% | Calls `createPlan` with aprBps=10001 (exceeds max 10000). Expects revert. |
| Update plan APR | Creates a plan at 4% APR. Calls `updatePlan(0, 500)` to change to 5%. Verifies `PlanUpdated` event and `plan.aprBps` now equals 500. |
| Enable/disable plan | Creates a plan (enabled by default). Calls `disablePlan` -> checks `plan.enabled === false`. Calls `enablePlan` -> checks `plan.enabled === true`. |

#### openDeposit (4 tests)

| Test | Logic |
|------|-------|
| Happy path | User approves SavingCore to spend 1,000 mUSDC. Calls `openDeposit(0, 1000)`. Verifies `DepositOpened` event and `deposit.principal === 1000`. |
| Below minimum | Deposits 5 mUSDC where min=10. Expects revert. |
| Above maximum | Deposits 20,000 mUSDC where max=10,000. Expects revert. |
| Disabled plan | Calls `disablePlan(0)`. Then tries to deposit. Expects revert. |

#### withdrawAtMaturity (3 tests)

| Test | Logic |
|------|-------|
| Correct interest | Fast-forwards 90 days (plan tenor). Calls `withdrawAtMaturity(0)`. Verifies `Withdrawn` event with calculated interest matching formula. |
| Too early | Calls `withdrawAtMaturity` before maturity. Expects revert ("Too early"). |
| Already withdrawn | Fast-forwards 90 days, withdraws successfully. Calls `withdrawAtMaturity` again on same deposit. Expects revert (status = Withdrawn). |

#### earlyWithdraw (2 tests)

| Test | Logic |
|------|-------|
| Correct penalty | Calls `earlyWithdraw(0)` before maturity. Verifies `Withdrawn` event with interest=0 and isEarly=true. Checks user receives principal minus penalty (950 for 5% penalty on 1000). |
| No interest paid | Early withdraws. Measures user's mUSDC balance before and after. Verifies net gain equals `principal - penalty`, with zero interest added. Checks feeReceiver received the penalty amount. |

#### renewDeposit (2 tests)

| Test | Logic |
|------|-------|
| Correct new principal | Fast-forwards 90 days. Calls `renewDeposit(0, 1)` to renew into Plan #1 (180 days, 5%). Verifies `Renewed` event with `newPrincipal = oldPrincipal + interest`. Checks SavingCore balance increased (interest pulled from vault). |
| Status update | Same setup. After renew, checks `deposits[0].status === 2 (ManualRenewed)`. |

#### autoRenewDeposit (2 tests)

| Test | Logic |
|------|-------|
| Before grace period | Fast-forwards exactly 90 days (maturity but not grace). Calls `autoRenewDeposit(0)`. Expects revert (still within 3-day grace period). |
| After grace + APR preserved | Fast-forwards 93 days (maturity + 3 day grace). Calls `autoRenewDeposit(0)`. Verifies `Renewed` event. Checks new deposit's `aprBpsAtOpen === 400` (original APR preserved, not current plan rate). |

#### Vault (3 tests - in `mockusdc-vault.test.ts`)

| Test | Logic |
|------|-------|
| Fund | Owner approves vault to spend tokens. Calls `fundVault(5000)`. Checks `totalVaultFunds` and vault token balance both equal 5000. |
| Withdraw | Funds vault with 5000, then calls `withdrawVault(2000)`. Checks vault balance decreased by 2000 and owner balance increased by 2000. |
| Insufficient vault | Funds vault then drains it via `withdrawVault`. Fast-forwards to maturity. Calls `withdrawAtMaturity` -> reverts with "Insufficient vault funds". |

#### Pause (2 tests - in `mockusdc-vault.test.ts`)

| Test | Logic |
|------|-------|
| Pause/unpause | Calls `pause()` -> checks `paused() === true`. Calls `unpause()` -> checks `paused() === false`. |
| Operations blocked | Funds vault. Pauses. Calls `fundVault` -> revert. Calls `withdrawVault` -> revert. |

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

### Demo Walkthrough

#### Phase 1: Admin Setup

| Step | Action | What to Expect |
|------|--------|----------------|
| 1 | Connect Admin account in MetaMask | Admin tab appears (only visible to owner address) |
| 2 | Create Plan #0: 90 days, 4% APR, 1% penalty, min 10, max 10,000 | PlanCreated event, plan appears in "Existing Plans" table |
| 3 | Create Plan #1: 180 days, 5% APR, 1% penalty, min 10, max 10,000 | Second plan created |
| 4 | Update Plan #0 APR to 4.5% (450 bps) | PlanUpdated event, APR changes in table |
| 5 | Click "Disable" on Plan #0 | Red dot appears, plan disabled for new deposits |
| 6 | Click "Enable" on Plan #0 | Green dot returns, plan usable again |
| 7 | Fund vault with 50,000 mUSDC | Approve transaction, then Fund transaction. Vault Balance updates |
| 8 | Set fee receiver to user address | FeeReceiverUpdated event |
| 9 | Click "All Deposits" toggle | Shows empty table (no deposits yet) |
| 10 | Withdraw vault (withdraw some tokens) | Vault Balance decreases, tokens returned to admin |

#### Phase 2: User Deposits

| Step | Action | What to Expect |
|------|--------|----------------|
| 1 | Switch to User account in MetaMask | Admin tab hidden, user sees Saving Plans and My Certificates tabs |
| 2 | Mint 500 mUSDC using the faucet input | Balance updates in navbar |
| 3 | Try depositing 5 mUSDC into Plan #0 | Red "Below minimum (10 mUSDC)" validation shown - transaction blocked |
| 4 | Try depositing 20,000 mUSDC into Plan #0 | Yellow "Above maximum" validation shown |
| 5 | Try depositing 2,000 mUSDC into Plan #0 | Red "Insufficient mUSDC balance" shown (you only have 500) |
| 6 | Mint 10,000 mUSDC via faucet | Balance now 10,500 mUSDC |
| 7 | Open deposit of 1,000 mUSDC in Plan #0 | Approve transaction, then Deposit transaction. Certificate #0 appears in My Certificates |
| 8 | Open another deposit of 1,000 mUSDC | Certificate #1 created |

#### Phase 3: Early Withdraw

| Step | Action | What to Expect |
|------|--------|----------------|
| 1 | On Certificate #0, click "Early Withdraw" | MetaMask confirms transaction |
| 2 | Check balance | User received 990 mUSDC (1000 - 1% penalty) |
| 3 | Check fee receiver balance | Receiver got 10 mUSDC penalty |
| 4 | Certificate #0 moves to History table | Status = "Withdrawn" |
| 5 | Open a new deposit of 1,000 mUSDC | Certificate #2 created |

#### Phase 4: Withdraw at Maturity

| Step | Action | What to Expect |
|------|--------|----------------|
| 1 | Open browser console (F12). Fast-forward 90 days | See fast-forward commands below |
| 2 | Refresh page | Certificate #2 shows "Matured" badge |
| 3 | Click "Withdraw" on Certificate #2 | Transaction confirms. Receive ~1,009.86 mUSDC (principal + ~9.86 interest) |
| 4 | Certificate #2 moves to History table | Status = "Withdrawn" |

#### Phase 5: Manual Renew

| Step | Action | What to Expect |
|------|--------|----------------|
| 1 | Open a new deposit of 1,000 mUSDC in Plan #0 | Certificate #3 created |
| 2 | Fast-forward 90 days | Maturity reached |
| 3 | Click "Renew" on Certificate #3 | Renewed event. New Certificate #4 appears in Plan #1 (180 days @ 5%) |
| 4 | Check Certificate #3 in History | Status = "Manual Renewed" |
| 5 | Check new principal | Interest is compounded - principal > 1,000 |

#### Phase 6: Auto Renew (Bot)

| Step | Action | What to Expect |
|------|--------|----------------|
| 1 | Open a new deposit of 1,000 mUSDC in Plan #0 | Certificate #5 created |
| 2 | Fast-forward 93 days (maturity + grace) | Use the commands below |
| 3 | Check the bot terminal | Should see: `Auto-renewing Certificate #5... -> Certificate #5 renewed` |
| 4 | Refresh frontend | Certificate #5 shows "Auto Renewed" in History. New Certificate #6 appears with original 4% APR preserved |

#### Phase 7: Edge Cases

| Step | Action | What to Expect |
|------|--------|----------------|
| 1 | As admin, withdraw vault to near zero | Leave only ~5 mUSDC |
| 2 | As user, open a deposit and fast-forward 90 days | New deposit matured |
| 3 | Try "Withdraw" on the matured deposit | Yellow "Vault insufficient" warning shown, Withdraw button is disabled |
| 4 | As admin, click "Pause System" | Red banner: "System is paused by admin - no deposits, withdrawals, or renewals allowed" |
| 5 | As user, try any action | Buttons are disabled with pause icon |
| 6 | As admin, click "Unpause System" | Banner disappears, operations resume |

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

## 9. License

MIT
