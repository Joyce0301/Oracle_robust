# Threat Model — Oracle Robustness Under Stress

> Owner: **Member A (Architecture)** + **Member B (Security & Stress Testing)**
>
> Last updated: 2026-03-28

## 1. System Boundaries

```
┌──────────────┐      getPrice()       ┌──────────────┐
│  LendingPool │ ◄──────────────────── │  IPriceOracle │
│  (protocol)  │                       │  (SpotOracle  │
│              │                       │   / MockOracle)│
└──────┬───────┘                       └───────────────┘
       │
       │ deposit / borrow / repay / liquidate
       │
   ┌───▼───┐
   │ Users │  (borrower, liquidator, attacker)
   └───────┘
```

**Trust assumptions in the current MVP**:

| Component | Trust Level | Notes |
|-----------|------------|-------|
| Oracle price | **Fully trusted** | Protocol does not validate, cap, or smooth prices |
| Oracle admin (owner) | **Trusted** | Single EOA can set any price at any time |
| LendingPool owner | Trusted | Can swap oracle via `setPriceOracle` |
| ERC-20 tokens | Trusted | MockToken has no access control on `mint` |

## 2. Threat Categories

### T1 — Oracle Price Manipulation

**Description**: Attacker (or compromised admin) sets an artificially high or low price via `setPrice()`.

**Impact**:
- **High price**: Borrower deposits small collateral, borrows far more than real value allows → protocol holds bad debt.
- **Low price**: Healthy positions appear underwater → unfair liquidation, borrower loses collateral.

**Demonstrated in**: `scenarios/inflated_oracle_borrow.cjs` (high price), `scenarios/flash_crash_liquidation.cjs` (low price).

---

### T2 — Stale / Delayed Price Feed

**Description**: Oracle price is not updated promptly (network congestion, oracle provider downtime). The on-chain price diverges from the real market.

**Impact**: Positions that should be liquidated remain "healthy" on-chain, or positions that have recovered are liquidated based on outdated data.

**Current status**: `MockOracle` records `lastUpdateTime` and `delayInSeconds` but `getPrice()` does **not** enforce freshness. This threat is **not yet testable** with current contract code.

**Recommended next step**: Add a freshness check in `MockOracle.getPrice()`:
```solidity
require(block.timestamp <= lastUpdateTime[asset] + delayInSeconds, "Price is stale");
```

---

### T3 — Oracle Source Swap

**Description**: The `LendingPool` owner calls `setPriceOracle(newOracle)` while positions are open. If the new oracle returns a significantly different price, existing positions may instantly become liquidatable (or un-liquidatable).

**Impact**: Systemic liquidation wave or inability to liquidate bad debt.

**Current status**: Not yet covered by a scenario script (planned).

---

### T4 — Front-running / MEV

**Description**: A liquidator observes a pending `setPrice` transaction in the mempool and submits a `liquidate` call in the same block, profiting from the guaranteed price change.

**Impact**: Borrowers are liquidated before they can react to price changes.

**Current status**: Not yet covered (would require Hardhat block manipulation with `evm_mine`).

## 3. Failure Criteria

These are the conditions under which we consider the oracle / protocol combination to have **failed** a stress test:

| ID | Criterion | Threshold |
|----|-----------|-----------|
| F1 | **Excess borrow** | User borrows > 80 % of *true market* collateral value |
| F2 | **Unfair liquidation** | Healthy position (true LTV < 80 %) is liquidated due to wrong oracle price |
| F3 | **Bad debt** | Debt value exceeds collateral value at market price with no economically rational liquidator |
| F4 | **Stale price window** | Oracle price age > acceptable threshold (e.g., 1 hour) and protocol still processes borrow/liquidate |
| F5 | **Liquidator loss** | Liquidator PnL < 0 at market prices (disincentivizes liquidation → bad debt accumulates) |

## 4. Scenario ↔ Threat Mapping

| Scenario | Threats Covered | Failure Criteria Triggered |
|----------|----------------|---------------------------|
| `flash_crash_liquidation` | T1 (low price) | F2 (borderline), observations on full-seize rule |
| `inflated_oracle_borrow` | T1 (high price) | F1, F3, F5 |
| `mock_oracle_baseline` | T2 (setup only) | — (baseline, delay not enforced) |

## 5. Mitigations (Not Implemented — For Discussion)

| Mitigation | Addresses | Complexity |
|------------|-----------|------------|
| TWAP (Time-Weighted Average Price) | T1, T4 | Medium |
| Multi-oracle median | T1, T2 | Medium |
| Price deviation circuit breaker | T1 | Low |
| Freshness check (`require` on timestamp) | T2 | Low |
| Partial liquidation (instead of full seize) | T1 economic impact | Medium |
| Liquidation grace period / delay | T4 | Low |
