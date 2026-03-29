/**
 * Stress scenario: collateral spot price drops (flash crash), position crosses 80% LTV → liquidation.
 *
 * Run: npx hardhat run scenarios/flash_crash_liquidation.cjs
 */
const { ethers } = require("hardhat");
const { deployStressFixture, formatUsdFrom18 } = require("./_fixture.cjs");
const { logEvent } = require("./lib/logger.cjs");

async function runFlashCrashLiquidation() {
  const { user, liquidator, collateral, debt, oracle, pool, collateralAddr } =
    await deployStressFixture();

  const depositAmt = ethers.parseEther("1");
  const borrowAmt = ethers.parseEther("1500");

  await collateral.mint(user.address, ethers.parseEther("10"));
  await debt.mint(liquidator.address, ethers.parseEther("500000"));

  await collateral.connect(user).approve(await pool.getAddress(), depositAmt);
  await debt.connect(liquidator).approve(await pool.getAddress(), ethers.parseEther("500000"));

  console.log("--- Flash crash liquidation ---");
  console.log("Initial oracle: 1 COL = 2000 USD, 1 DEBT = 1 USD");
  await pool.connect(user).deposit(depositAmt);
  await pool.connect(user).borrow(borrowAmt);
  console.log(`User: deposited ${ethers.formatEther(depositAmt)} COL, borrowed ${ethers.formatEther(borrowAmt)} DEBT`);
  console.log("LTV before crash: debt 1500 / collateral 2000 = 75% (< 80% healthy)");

  logEvent("position_opened", {
    scenario: "flash_crash_liquidation",
    collateralDeposited: depositAmt,
    debtBorrowed: borrowAmt,
    ltvPercent: "75",
  });

  const newColPrice = ethers.parseEther("1800");
  await oracle.setPrice(collateralAddr, newColPrice);
  console.log(`Oracle update: 1 COL = ${formatUsdFrom18(newColPrice)} USD`);
  console.log("LTV after crash: 1500 / 1800 ≈ 83.3% (> 80% unhealthy)");

  logEvent("oracle_shocked", { collateralPrice: newColPrice, newLtvPercent: "83.3" });

  const liqDebtBefore = await debt.balanceOf(liquidator.address);
  const liqColBefore = await collateral.balanceOf(liquidator.address);

  await pool.connect(liquidator).liquidate(user.address);

  const liqDebtAfter = await debt.balanceOf(liquidator.address);
  const liqColAfter = await collateral.balanceOf(liquidator.address);

  const debtPaid = liqDebtBefore - liqDebtAfter;
  const colReceived = liqColAfter - liqColBefore;

  console.log("\n--- Outcome ---");
  console.log(`Liquidator paid: ${ethers.formatEther(debtPaid)} DEBT`);
  console.log(`Liquidator received: ${ethers.formatEther(colReceived)} COL`);
  console.log(
    `At post-crash oracle (1800 USD/COL): collateral received ≈ $${Number(formatUsdFrom18(newColPrice)) * Number(ethers.formatEther(colReceived))}`
  );
  console.log(`Debt paid (notional USD): $${formatUsdFrom18(borrowAmt)}`);
  console.log(
    "Failure criterion (example): borrower lost entire collateral; protocol relies on single spot oracle for health + liquidation."
  );

  logEvent("position_liquidated", { debtPaid, collateralReceived: colReceived, liquidatorPnlUsd: Number(formatUsdFrom18(newColPrice)) * Number(ethers.formatEther(colReceived)) - Number(formatUsdFrom18(borrowAmt)) });
}

async function main() {
  await runFlashCrashLiquidation();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { runFlashCrashLiquidation };
