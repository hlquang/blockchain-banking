temporary readme.md
# Final Assignment: Online Banking System (Blockchain)

A blockchain-based term deposit system similar to a bank savings account, running entirely on smart contracts. Users lock tokens for a fixed period, earn interest, and can withdraw when the term ends.

## Project Overview

### Smart Contracts

| Contract | File | Status | Description |
|----------|------|--------|-------------|
| MockUSDC | `contracts/MockUSDC.sol` | ✅ Done | ERC20 token with 6 decimals, mintable for testing |
| VaultManager | `contracts/VaultManager.sol` | ✅ Done | Vault funding, fee receiver, pause/unpause |
| SavingCore | `contracts/SavingCore.sol` | ⏳ Pending | Plan management, deposit logic, withdraw, renew, ERC721 NFTs |

### System Architecture

```
MockUSDC (ERC20 - 6 decimals)
       ↓
VaultManager (Liquidity pool for interest)
       ↓
SavingCore (Core deposit logic + ERC721 NFTs)
       ↓
User (Depositor)
```

## Project Structure

```
final/
├── contracts/
│   ├── MockUSDC.sol            ✅ Created
│   ├── VaultManager.sol        ✅ Created
│   └── SavingCore.sol          ⏳ Pending
├── deploy/
│   ├── 1-deploy-mockusdc.ts    ✅ Created
│   ├── 2-deploy-vaultmanager.ts ✅ Created
│   └── 3-deploy-savingcore.ts  ⏳ Pending
├── test/
│   └── mockusdc-vault.test.ts  ✅ 12 tests passing
├── scripts/
├── cache/
├── typechain/
├── hardhat.config.ts
├── package.json
└── tsconfig.json
```

## Progress

### Phase 1: Smart Contracts ✅ (In Progress)

- [x] MockUSDC.sol - ERC20 with 6 decimals, mintable
- [x] VaultManager.sol - Vault funding, fee receiver, pause/unpause
- [ ] SavingCore.sol - Core logic with ERC721 NFTs (pending)

### Phase 2: Deployment Scripts ✅ (In Progress)

- [x] `1-deploy-mockusdc.ts`
- [x] `2-deploy-vaultmanager.ts`
- [ ] `3-deploy-savingcore.ts` (pending)

### Phase 3: Tests ⏳ (Pending)

- [x] MockUSDC tests (4 tests)
- [x] VaultManager tests (8 tests)
- [ ] SavingCore tests (to be created)
- Target: >90% coverage

### Phase 4: Frontend ⏳ (Pending)

- React app with MetaMask connection
- View plans, open deposits, view active deposits, withdraw/renew

## Test Results

```
MockUSDC
  ✓ should have correct name and symbol
  ✓ should have 6 decimals
  ✓ should allow minting tokens
  ✓ should handle transfer correctly

VaultManager
  ✓ should set correct token address
  ✓ should set feeReceiver to deployer
  ✓ should allow funding vault
  ✓ should allow admin to withdraw from vault
  ✓ should allow paying interest
  ✓ should allow updating feeReceiver
  ✓ should allow pausing and unpausing
  ✓ should block operations when paused

12 passing
```

## Installation & Setup

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to local Hardhat node
npx hardhat deploy

# Deploy to Sepolia testnet
npx hardhat deploy --network sepolia
```

## SavingCore Features (Pending)

### Saving Plan
Each plan has:
- `minAmount` / `maxAmount` - deposit limits
- `tenorDays` - duration in days
- `aprBps` - Annual Percentage Rate (in basis points)
- `penaltyBps` - Early withdrawal penalty
- `enabled` - active status

### Deposit Certificate (NFT)
- ERC721 NFT representing the deposit
- Snapshots APR and penalty at open time
- Status: Active, Withdrawn, ManualRenewed, AutoRenewed

### User Flows

| Flow | Description |
|------|-------------|
| Open Deposit | User selects plan, deposits tokens, receives NFT |
| Withdraw at Maturity | User withdraws principal + interest from vault |
| Early Withdraw | User withdraws with penalty, no interest |
| Manual Renew | User renews at maturity, interest compounds |
| Auto Renew | After 3-day grace, bot triggers auto-renew |

### Interest Formula

```
Interest = (principal × aprBps × tenorDays) / 365 / 10000
```

Example: 1,000 USDC × 250 bps × 90 days / 365 / 10000 = 6.16 USDC

## Required Test Cases (per assignment)

- [x] MockUSDC: name, symbol, decimals, mint, transfer
- [x] VaultManager: fund, withdraw, pay interest, fee receiver, pause
- [ ] SavingCore:
  - [ ] createPlan: valid plan, disabled plan, invalid APR
  - [ ] openDeposit: happy path, below min, above max, disabled plan
  - [ ] withdrawAtMaturity: correct interest, too early, already withdrawn
  - [ ] earlyWithdraw: correct penalty, no interest paid
  - [ ] renewDeposit (manual): correct new principal, status update
  - [ ] autoRenewDeposit: before grace period, after grace period, APR locked
  - [ ] Pause: withdraw blocked when paused

## Key Concepts

- **1 basis point (bps)** = 0.01%
- **APR 250 bps** = 2.50% annual rate
- **Tenor** = deposit term in days
- **Principal** = initial deposit amount
- **Interest** = earned money from vault (not principal pool)
- **Penalty** = fee for early withdrawal, goes to feeReceiver

## Business Rules

1. APR and penalty are snapshotted at deposit open
2. Admin changes to a plan never affect existing deposits
3. Interest uses simple interest only (no compounding within a term)
4. Early withdrawal gives zero interest
5. Auto-renew preserves the original APR
6. Interest is always paid from the vault
7. When paused, no withdrawals or renewals are allowed
8. Admin cannot alter a deposit that is already open

## Next Steps

1. Create `SavingCore.sol` with adjustments:
   - Add `tenorDays` to DepositCertificate struct
   - Allow bot to call `autoRenewDeposit` (remove owner check)
   - Interest goes to SavingCore for compounding on renew
2. Create deployment script for SavingCore
3. Write comprehensive tests for SavingCore
4. Build React frontend
5. Deploy to Sepolia testnet

## Notes

- OpenZeppelin v5.x is used
- Solidity 0.8.28 with viaIR optimization
- Hardhat + TypeScript + ethers.js v6
- TypeChain for type-safe contract interactions