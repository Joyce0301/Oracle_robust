# Stress Scenarios

> Owner: **Member B (Security & Stress Testing)**

Adversarial and stress-testing scripts for the Oracle Robustness project.

## File Index

| File | Scenario | Key Observation |
|------|----------|-----------------|
| `_fixture.cjs` | Shared deployment helper | Deploys tokens, oracle, pool; mints 1 M DEBT liquidity |
| `flash_crash_liquidation.cjs` | Collateral flash crash (2000 → 1800) | 75 % → 83 % LTV; full liquidation triggered |
| `inflated_oracle_borrow.cjs` | Inflated oracle price (10 000 vs 2 000) | Borrower extracts excess debt; liquidator PnL = −$6 000 |
| `mock_oracle_baseline.cjs` | MockOracle with delay field | Baseline: delay recorded but not enforced |
| `run_all.cjs` | Runs all above sequentially | — |

## Quick Start

```bash
# Run all
npx hardhat run scenarios/run_all.cjs

# Or individually
npx hardhat run scenarios/flash_crash_liquidation.cjs
npx hardhat run scenarios/inflated_oracle_borrow.cjs
npx hardhat run scenarios/mock_oracle_baseline.cjs
```

## Adding a New Scenario

1. Create `scenarios/your_scenario.cjs`.
2. Import shared setup from `_fixture.cjs`:
   ```js
   const { deployStressFixture, formatUsdFrom18 } = require("./_fixture.cjs");
   ```
3. Write your main function and export it.
4. Guard direct execution:
   ```js
   if (require.main === module) {
     main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
   }
   ```
5. Add it to `run_all.cjs` imports and `main()`.
6. Update `docs/experiment-design.md` with the scenario description.

## Design Principles

- **Reproducible**: Every run deploys a fresh set of contracts on the Hardhat local chain. No persistent state between runs.
- **Self-documenting**: Each script prints a narrative log (initial state, action, outcome, failure criteria).
- **Composable**: Import any scenario function from `run_all.cjs` or your own orchestrator.
