# Experiment Design — Stress Scenarios for Oracle Robustness

> Owner: **Member B (Security & Stress Testing)**
>
> Last updated: 2026-03-29

## 1. Purpose

This document describes the adversarial and stress scenarios implemented in the `scenarios/` directory. Each scenario exercises the `LendingPool` protocol under abnormal oracle conditions to expose vulnerabilities in pricing, liquidation, and borrower/lender economics.

## 2. Environment

| Component | Implementation | Notes |
|-----------|---------------|-------|
| Collateral Token | `MockToken("Collateral", "COL")` | ERC-20, freely mintable |
| Debt Token | `MockToken("Debt", "DEBT")` | ERC-20, freely mintable |
| Oracle (default) | `SpotOracle` | Admin-set prices via `setPrice()` |
| Oracle (TWAP) | `TWAPOracle` | Time-weighted average over configurable window (default 30 min) |
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

### 3.4 TWAP Flash Crash Comparison (SpotOracle vs TWAPOracle)

| Field | Value |
|-------|-------|
| File | `scenarios/twap_flash_crash_comparison.cjs` |
| Run | `npx hardhat run scenarios/twap_flash_crash_comparison.cjs` |

**Narrative**: Two LendingPools are deployed with identical parameters — one uses `SpotOracle`, the other `TWAPOracle` (30-min window). A user opens the same position (deposit 1 COL, borrow 1 500 DEBT) in both pools. Collateral price crashes from 2 000 → 1 800 USD. The scenario compares liquidation behavior across the two oracle types.

**Steps**:

1. Deploy tokens, SpotOracle, TWAPOracle (window = 1 800 s), and two LendingPools.
2. Let TWAP accumulate history at 2 000 USD for a full window.
3. Open identical positions in both pools (1 COL deposit, 1 500 DEBT borrow).
4. Crash price to 1 800 USD on both oracles simultaneously.
5. Attempt liquidation on both pools immediately.
6. For TWAP pool: if liquidation fails, advance time in increments and retry until TWAP catches up.

**Expected output**:

| Metric | SpotOracle Pool | TWAPOracle Pool |
|--------|----------------|-----------------|
| Oracle price after crash | 1 800 USD | ~1 900 USD (smoothed) |
| LTV after crash | ≈ 83.3 % | ≈ 78.9 % |
| Immediate liquidation | Succeeds | Fails (position healthy) |
| Liquidation delay | 0 s | Several minutes (TWAP catch-up) |

**Failure criteria observed**: SpotOracle triggers instant liquidation with no buffer. TWAPOracle gives borrowers a time window to react (add collateral or repay), reducing unfair liquidations under transient price dips.

---

### 3.5 TWAP Inflated Price Comparison (Manipulation Resistance)

| Field | Value |
|-------|-------|
| File | `scenarios/twap_inflated_price.cjs` |
| Run | `npx hardhat run scenarios/twap_inflated_price.cjs` |

**Narrative**: An attacker pushes a single inflated price (10 000 USD, 5× real) to both oracles. Under SpotOracle, the attacker borrows 8 000 DEBT (80 % of fake 10 000 value). Under TWAPOracle, `getPrice()` returns a blend of old price (2 000) and new price (10 000), limiting the borrowable amount.

**Steps**:

1. Deploy tokens, SpotOracle, TWAPOracle, two LendingPools.
2. TWAP accumulates 30 min of history at 2 000 USD.
3. Push inflated price 10 000 to both oracles.
4. SpotOracle pool: user borrows 8 000 DEBT (should succeed).
5. TWAPOracle pool: user attempts 8 000 DEBT borrow (should fail); retry at TWAP-allowed max.
6. Log comparison of borrowable amounts and protocol exposure.

**Expected output**:

| Metric | SpotOracle Pool | TWAPOracle Pool |
|--------|----------------|-----------------|
| Oracle price after manipulation | 10 000 USD | ~6 000 USD (blended) |
| Max borrowable (80 % LTV) | 8 000 DEBT | ~4 800 DEBT |
| Excess debt over real value | $6 400 | ~$3 200 |
| Manipulation damage reduction | — | ~50 % |

**Failure criteria observed**: SpotOracle allows full extraction of inflated value. TWAPOracle reduces exploitable borrow by roughly half, but still allows some excess borrowing if the inflated price persists.

---

## 4. How to Run

```bash
# Individual
npx hardhat run scenarios/flash_crash_liquidation.cjs
npx hardhat run scenarios/inflated_oracle_borrow.cjs
npx hardhat run scenarios/mock_oracle_baseline.cjs
npx hardhat run scenarios/twap_flash_crash_comparison.cjs
npx hardhat run scenarios/twap_inflated_price.cjs

# All at once
npx hardhat run scenarios/run_all.cjs

# Via npm
npm run scenario:flash
npm run scenario:inflated
npm run scenario:mock
npm run scenario:twap-compare
npm run scenario:twap-inflated
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
| TWAP window sensitivity | Replay flash crash with different TWAP windows (5 min, 30 min, 2 hr) to find optimal trade-off | — |

## 6. Metrics to Collect (for Member C)

For each scenario run, the following values should be recorded for analysis:

- Pre- and post-crash **LTV ratio**
- **Liquidator PnL** (notional USD)
- **Borrower loss** (collateral seized vs debt owed)
- **Protocol bad debt** (debt remaining that no one has incentive to liquidate)
- **Oracle deviation** from "true" market price at time of action
