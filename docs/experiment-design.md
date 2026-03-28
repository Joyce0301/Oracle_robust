# Experiment Design — Stress Scenarios for Oracle Robustness

> Owner: **Member B (Security & Stress Testing)**
>
> Last updated: 2026-03-28

## 1. Purpose

This document describes the adversarial and stress scenarios implemented in the `scenarios/` directory. Each scenario exercises the `LendingPool` protocol under abnormal oracle conditions to expose vulnerabilities in pricing, liquidation, and borrower/lender economics.

## 2. Environment

| Component | Implementation | Notes |
|-----------|---------------|-------|
| Collateral Token | `MockToken("Collateral", "COL")` | ERC-20, freely mintable |
| Debt Token | `MockToken("Debt", "DEBT")` | ERC-20, freely mintable |
| Oracle (default) | `SpotOracle` | Admin-set prices via `setPrice()` |
| Oracle (stress) | `MockOracle` | Adds `lastUpdateTime` / `delayInSeconds` (delay not yet enforced) |
| Lending Pool | `LendingPool` | 80 % LTV liquidation threshold |
| Pool Liquidity | 1,000,000 DEBT pre-minted | Ensures large borrows don't fail on balance |

Shared setup is in `scenarios/_fixture.cjs`. Initial prices:

- 1 COL = **2 000** USD (18 decimals)
- 1 DEBT = **1** USD (18 decimals)

## 3. Scenario Catalog

### 3.1 Flash Crash Liquidation

| Field | Value |
|-------|-------|
| File | `scenarios/flash_crash_liquidation.cjs` |
| Run | `npx hardhat run scenarios/flash_crash_liquidation.cjs` |

**Narrative**: A user deposits 1 COL and borrows 1 500 DEBT (LTV 75 %, healthy). The collateral price then crashes from 2 000 → 1 800 USD. The new LTV becomes ≈ 83.3 %, exceeding the 80 % threshold, so a liquidator seizes the full position.

**Steps**:

1. Deploy environment (`_fixture`).
2. User deposits **1 COL**, borrows **1 500 DEBT**.
3. Oracle owner calls `setPrice(COL, 1800e18)`.
4. Liquidator calls `liquidate(user)`.
5. Log pre/post balances and notional USD values.

**Expected output**:

| Metric | Value |
|--------|-------|
| LTV before crash | 75 % |
| LTV after crash | ≈ 83.3 % |
| Liquidator pays | 1 500 DEBT ($1 500) |
| Liquidator receives | 1 COL ($1 800 at new price) |
| Liquidator profit | ≈ $300 |
| Borrower loss | Entire 1 COL collateral |

**Failure criteria observed**: A single oracle price update triggers full collateral seizure. No partial liquidation, no grace period, no secondary price source.

---

### 3.2 Inflated Oracle Borrow

| Field | Value |
|-------|-------|
| File | `scenarios/inflated_oracle_borrow.cjs` |
| Run | `npx hardhat run scenarios/inflated_oracle_borrow.cjs` |

**Narrative**: The oracle is compromised or erroneous, reporting COL price as 10 000 USD (5× real market price 2 000). A user deposits 1 COL and borrows 8 000 DEBT (80 % of the inflated 10 000 value). When the oracle corrects to 2 000, the position is deeply underwater (debt $8 000 vs collateral $2 000). A liquidator who seizes the position pays $8 000 in debt but only receives $2 000 in collateral, losing $6 000.

**Steps**:

1. Deploy environment; set `COL` price to **10 000** via `setPrice`.
2. User deposits **1 COL**, borrows **8 000 DEBT**.
3. Oracle corrected: `setPrice(COL, 2000e18)`.
4. Liquidator calls `liquidate(user)`.
5. Log liquidation economics.

**Expected output**:

| Metric | Value |
|--------|-------|
| Borrow LTV (inflated oracle) | 80 % |
| True LTV (market) | 400 % |
| Liquidator pays | 8 000 DEBT ($8 000) |
| Liquidator receives | 1 COL ($2 000) |
| Liquidator PnL | **−$6 000** |

**Failure criteria observed**:

- Borrower extracted $8 000 of debt against only $2 000 of real collateral — a $6 000 protocol loss.
- Liquidation is economically irrational for the liquidator, so in practice the bad debt may remain un-liquidated.
- Root cause: protocol trusts a single oracle with no sanity bounds, no TWAP, and no circuit breaker.

---

### 3.3 MockOracle Baseline

| Field | Value |
|-------|-------|
| File | `scenarios/mock_oracle_baseline.cjs` |
| Run | `npx hardhat run scenarios/mock_oracle_baseline.cjs` |

**Narrative**: Deploys the full stack with `MockOracle` instead of `SpotOracle`. Sets `delayInSeconds = 3600` and confirms that `getPrice()` still returns the latest price (delay is recorded but **not enforced** in the current implementation).

**Purpose**: Establish a baseline for future stale-price scenarios. Once `MockOracle.getPrice()` is updated to revert or return stale values when `block.timestamp < lastUpdateTime + delay`, this scenario can be extended to test delayed liquidation, stale borrow checks, etc.

---

## 4. How to Run

```bash
# Individual
npx hardhat run scenarios/flash_crash_liquidation.cjs
npx hardhat run scenarios/inflated_oracle_borrow.cjs
npx hardhat run scenarios/mock_oracle_baseline.cjs

# All at once
npx hardhat run scenarios/run_all.cjs

# Via npm
npm run scenario:flash
npm run scenario:inflated
npm run scenario:mock
npm run scenario:all
```

All scenarios run on the Hardhat built-in local chain; no external network or funds required.

## 5. Planned Future Scenarios

| Scenario | Description | Depends on |
|----------|-------------|------------|
| Stale price liquidation | Oracle delays price update; position becomes unhealthy but oracle still returns old "healthy" price | `MockOracle.getPrice` enforcing delay |
| Multi-step price ladder | Price drops in 5 % increments; observe at which step liquidation becomes profitable | — |
| Oracle swap mid-position | Owner calls `setPriceOracle()` to switch oracle source while positions are open; new oracle has different price | — |
| Front-running liquidation | Liquidator observes pending `setPrice` tx and front-runs `liquidate` in the same block | Hardhat `evm_mine` / block manipulation |

## 6. Metrics to Collect (for Member C)

For each scenario run, the following values should be recorded for analysis:

- Pre- and post-crash **LTV ratio**
- **Liquidator PnL** (notional USD)
- **Borrower loss** (collateral seized vs debt owed)
- **Protocol bad debt** (debt remaining that no one has incentive to liquidate)
- **Oracle deviation** from "true" market price at time of action
