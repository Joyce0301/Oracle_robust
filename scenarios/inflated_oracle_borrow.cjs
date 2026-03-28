/**
 * Stress scenario: oracle reports inflated collateral price → user borrows up to 80% of *fake* value →
 * price corrected to market → position deeply underwater; liquidation may be economically unattractive.
 *
 * Run: npx hardhat run scenarios/inflated_oracle_borrow.cjs
 */
const { ethers } = require("hardhat");
const { deployStressFixture, formatUsdFrom18 } = require("./_fixture.cjs");

async function runInflatedOracleBorrow() {
  const { user, liquidator, collateral, debt, oracle, pool, collateralAddr, debtAddr } =
    await deployStressFixture();

  const inflatedPrice = ethers.parseEther("10000");
  const marketPrice = ethers.parseEther("2000");

  await oracle.setPrice(collateralAddr, inflatedPrice);
  console.log("--- Inflated oracle borrow ---");
  console.log(`Oracle (manipulated / wrong): 1 COL = ${formatUsdFrom18(inflatedPrice)} USD`);

  await collateral.mint(user.address, ethers.parseEther("10"));
  await debt.mint(liquidator.address, ethers.parseEther("500000"));

  const depositAmt = ethers.parseEther("1");
  const maxBorrowAtInflated = ethers.parseEther("8000");

  await collateral.connect(user).approve(await pool.getAddress(), depositAmt);
  await debt.connect(liquidator).approve(await pool.getAddress(), ethers.parseEther("500000"));

  await pool.connect(user).deposit(depositAmt);
  await pool.connect(user).borrow(maxBorrowAtInflated);
  console.log(
    `User borrowed ${ethers.formatEther(maxBorrowAtInflated)} DEBT (80% of inflated collateral value 10000 USD)`
  );

  await oracle.setPrice(collateralAddr, marketPrice);
  const debtP = await oracle.getPrice(debtAddr);
  const colP = await oracle.getPrice(collateralAddr);
  const debtVal = (maxBorrowAtInflated * debtP) / ethers.parseEther("1");
  const colVal = (depositAmt * colP) / ethers.parseEther("1");
  const threshold = (colVal * 80n) / 100n;
  console.log(`\nOracle corrected: 1 COL = ${formatUsdFrom18(marketPrice)} USD`);
  console.log(`Notional debt value: ${formatUsdFrom18(debtVal)} USD`);
  console.log(`Notional collateral value: ${formatUsdFrom18(colVal)} USD`);
  console.log(`80% of collateral: ${formatUsdFrom18(threshold)} USD — position unhealthy: ${debtVal > threshold}`);

  const liqDebtBefore = await debt.balanceOf(liquidator.address);
  const liqColBefore = await collateral.balanceOf(liquidator.address);

  await pool.connect(liquidator).liquidate(user.address);

  const debtPaid = liqDebtBefore - (await debt.balanceOf(liquidator.address));
  const colReceived = (await collateral.balanceOf(liquidator.address)) - liqColBefore;

  const colUsd = (colReceived * marketPrice) / ethers.parseEther("1");
  const paidUsd = (debtPaid * debtP) / ethers.parseEther("1");
  const pnl = colUsd - paidUsd;

  console.log("\n--- Liquidation economics (at corrected oracle) ---");
  console.log(`Liquidator paid: ${ethers.formatEther(debtPaid)} DEBT (~$${formatUsdFrom18(paidUsd)})`);
  console.log(`Liquidator received: ${ethers.formatEther(colReceived)} COL (~$${formatUsdFrom18(colUsd)})`);
  console.log(`Notional liquidator PnL (COL_usd - DEBT_usd): ${formatUsdFrom18(pnl)} USD`);
  console.log(
    "Failure criterion (example): borrowers could extract excess debt under wrong prices; liquidators may take large notional loss under this simplified full-seize rule."
  );
}

async function main() {
  await runInflatedOracleBorrow();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { runInflatedOracleBorrow };
