## Scenario Tooling

This folder now contains a standardized entrypoint for stress testing:

- `run_price_shock.cjs`: opens a borrowing position, shocks the collateral price, and triggers liquidation.
- `lib/config.cjs`: loads machine-readable deployment outputs from `deployments/mvp.<network>.json`.
- `lib/logger.cjs`: emits JSON logs for downstream analysis.

### Typical Flow

1. Start `npx hardhat node`
2. Run `npx hardhat run scripts/deploy_mvp.cjs --network localhost`
3. Confirm `deployments/mvp.localhost.json` exists
4. Run `npx hardhat run scenarios/run_price_shock.cjs --network localhost`

### Parameters

You can override scenario inputs with `SCENARIO_PARAMS`:

```bash
SCENARIO_PARAMS='{"depositAmount":"2","borrowAmount":"2200","shockedCollateralPrice":"1200"}' \
npx hardhat run scenarios/run_price_shock.cjs
```

### Output

Each scenario stage prints a JSON object so group members can parse logs into metrics such as:

- price error
- liquidation trigger conditions
- position state before and after shock
