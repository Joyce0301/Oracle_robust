/**
 * Run all stress scenarios in one Hardhat network session.
 *
 * Run: npx hardhat run scenarios/run_all.cjs
 */
const { runFlashCrashLiquidation } = require("./flash_crash_liquidation.cjs");
const { runInflatedOracleBorrow } = require("./inflated_oracle_borrow.cjs");
const { runMockOracleBaseline } = require("./mock_oracle_baseline.cjs");

async function main() {
  console.log("\n########## 1/3 flash_crash_liquidation ##########\n");
  await runFlashCrashLiquidation();
  console.log("\n########## 2/3 inflated_oracle_borrow ##########\n");
  await runInflatedOracleBorrow();
  console.log("\n########## 3/3 mock_oracle_baseline ##########\n");
  await runMockOracleBaseline();
  console.log("\nAll scenarios finished.\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
