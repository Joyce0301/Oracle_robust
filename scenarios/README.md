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
| `twap_flash_crash_comparison.cjs` | SpotOracle vs TWAPOracle under flash crash | TWAP smooths crash, delays liquidation |
| `twap_inflated_price.cjs` | SpotOracle vs TWAPOracle under price inflation | TWAP limits excess borrowing from manipulated price |
| `run_price_shock.cjs` | Standardized price shock (Dylan) | Reads from `deployments/`, emits JSON logs |
| `run_all.cjs` | Runs all self-contained scenarios sequentially | — |

## Quick Start

```bash
# Run all self-contained scenarios (no running node needed)
npx hardhat run scenarios/run_all.cjs

# Or individually
npx hardhat run scenarios/flash_crash_liquidation.cjs
npx hardhat run scenarios/inflated_oracle_borrow.cjs
npx hardhat run scenarios/mock_oracle_baseline.cjs
npx hardhat run scenarios/twap_flash_crash_comparison.cjs
npx hardhat run scenarios/twap_inflated_price.cjs
```

## Deployment-Based Scenarios (Dylan's Tooling)

These scenarios read pre-deployed addresses from `deployments/mvp.<network>.json`:

```bash
npx hardhat node
npx hardhat run scripts/deploy_mvp.cjs --network localhost
npx hardhat run scenarios/run_price_shock.cjs --network localhost
```

Override parameters with `SCENARIO_PARAMS`:

```bash
SCENARIO_PARAMS='{"depositAmount":"2","borrowAmount":"2200","shockedCollateralPrice":"1200"}' \
npx hardhat run scenarios/run_price_shock.cjs
```

## Shared Libraries

| File | Purpose |
|------|---------|
| `lib/config.cjs` | Loads deployment addresses from `deployments/mvp.<network>.json` |
| `lib/logger.cjs` | Emits structured JSON logs (`logEvent(stage, payload)`) for downstream analysis |

## Adding a New Scenario

1. Create `scenarios/your_scenario.cjs`.
2. Import shared setup from `_fixture.cjs`:
   ```js
   const { deployStressFixture, formatUsdFrom18 } = require("./_fixture.cjs");
   ```
3. Import the logger for structured output:
   ```js
   const { logEvent } = require("./lib/logger.cjs");
   ```
4. Write your main function and export it.
5. Guard direct execution:
   ```js
   if (require.main === module) {
     main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
   }
   ```
6. Add it to `run_all.cjs` imports and `main()`.
7. Update `docs/experiment-design.md` with the scenario description.

## Design Principles

- **Reproducible**: Every run deploys a fresh set of contracts on the Hardhat local chain. No persistent state between runs.
- **Self-documenting**: Each script prints a narrative log (initial state, action, outcome, failure criteria).
- **Structured**: All scenarios emit JSON logs via `logEvent()` for automated analysis by Member C.
- **Composable**: Import any scenario function from `run_all.cjs` or your own orchestrator.
