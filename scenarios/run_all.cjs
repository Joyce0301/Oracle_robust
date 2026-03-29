/**
 * Run all stress scenarios in one Hardhat network session.
 *
 * Run: npx hardhat run scenarios/run_all.cjs
 */
const { runFlashCrashLiquidation } = require("./flash_crash_liquidation.cjs");
const { runInflatedOracleBorrow } = require("./inflated_oracle_borrow.cjs");
const { runMockOracleBaseline } = require("./mock_oracle_baseline.cjs");
const { runTwapFlashCrashComparison } = require("./twap_flash_crash_comparison.cjs");
const { runTwapInflatedPrice } = require("./twap_inflated_price.cjs");

async function main() {
  console.log("\n########## 1/5 flash_crash_liquidation ##########\n");
  await runFlashCrashLiquidation();
  console.log("\n########## 2/5 inflated_oracle_borrow ##########\n");
  await runInflatedOracleBorrow();
  console.log("\n########## 3/5 mock_oracle_baseline ##########\n");
  await runMockOracleBaseline();
  console.log("\n########## 4/5 twap_flash_crash_comparison ##########\n");
  await runTwapFlashCrashComparison();
  console.log("\n########## 5/5 twap_inflated_price ##########\n");
  await runTwapInflatedPrice();
  console.log("\nAll scenarios finished.\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
