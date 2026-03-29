/**
 * Stress scenario: SpotOracle vs TWAPOracle under price inflation (manipulation).
 *
 * Attacker pushes a single inflated price to both oracles.
 * SpotOracle: getPrice returns inflated value immediately → excess borrow succeeds.
 * TWAPOracle: getPrice returns a blend of old + new → excess borrow may be blocked.
 *
 * Run: npx hardhat run scenarios/twap_inflated_price.cjs
 */
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { logEvent } = require("./lib/logger.cjs");

const ONE = ethers.parseEther("1");
const TWAP_WINDOW = 1800;

async function runTwapInflatedPrice() {
  const [deployer, user] = await ethers.getSigners();

  const MockToken = await ethers.getContractFactory("MockToken");
  const collateral = await MockToken.deploy("Collateral", "COL");
  const debt = await MockToken.deploy("Debt", "DEBT");
  await collateral.waitForDeployment();
  await debt.waitForDeployment();
  const cAddr = await collateral.getAddress();
  const dAddr = await debt.getAddress();

  const SpotOracle = await ethers.getContractFactory("SpotOracle");
  const spotOracle = await SpotOracle.deploy();
  await spotOracle.waitForDeployment();

  const TWAPOracle = await ethers.getContractFactory("TWAPOracle");
  const twapOracle = await TWAPOracle.deploy(TWAP_WINDOW);
  await twapOracle.waitForDeployment();

  const realPrice = ethers.parseEther("2000");
  const inflatedPrice = ethers.parseEther("10000");

  await spotOracle.setPrice(cAddr, realPrice);
  await spotOracle.setPrice(dAddr, ONE);
  await twapOracle.pushPrice(cAddr, realPrice);
  await twapOracle.pushPrice(dAddr, ONE);

  // Let TWAP accumulate history at real price
  await time.increase(TWAP_WINDOW);

  const LendingPool = await ethers.getContractFactory("LendingPool");
  const spotPool = await LendingPool.deploy(cAddr, dAddr, await spotOracle.getAddress());
  const twapPool = await LendingPool.deploy(cAddr, dAddr, await twapOracle.getAddress());
  await spotPool.waitForDeployment();
  await twapPool.waitForDeployment();

  const poolLiquidity = ethers.parseEther("1000000");
  await debt.mint(await spotPool.getAddress(), poolLiquidity);
  await debt.mint(await twapPool.getAddress(), poolLiquidity);

  const depositAmt = ethers.parseEther("1");
  await collateral.mint(user.address, ethers.parseEther("10"));

  await collateral.connect(user).approve(await spotPool.getAddress(), depositAmt);
  await collateral.connect(user).approve(await twapPool.getAddress(), depositAmt);

  console.log("=== TWAP vs Spot Inflated Price Comparison ===");
  console.log(`Real price: ${ethers.formatEther(realPrice)} USD`);
  console.log(`Inflated price: ${ethers.formatEther(inflatedPrice)} USD (5x manipulation)`);
  console.log(`TWAP window: ${TWAP_WINDOW}s\n`);

  logEvent("scenario_start", { scenario: "twap_inflated_price", realPrice, inflatedPrice, twapWindow: TWAP_WINDOW });

  // --- Inflate the price ---
  await spotOracle.setPrice(cAddr, inflatedPrice);
  await twapOracle.pushPrice(cAddr, inflatedPrice);

  const spotP = await spotOracle.getPrice(cAddr);
  const twapP = await twapOracle.getPrice(cAddr);

  console.log("--- After inflated price push ---");
  console.log(`SpotOracle getPrice: ${ethers.formatEther(spotP)} USD`);
  console.log(`TWAPOracle getPrice: ${ethers.formatEther(twapP)} USD (blended)\n`);

  logEvent("oracle_inflated", { spotPrice: spotP, twapPrice: twapP });

  // --- SpotOracle pool: borrow 80% of inflated value = 8000 ---
  const excessBorrow = ethers.parseEther("8000");

  await spotPool.connect(user).deposit(depositAmt);
  console.log("[SpotOracle Pool] Deposited 1 COL");
  console.log(`[SpotOracle Pool] Attempting to borrow ${ethers.formatEther(excessBorrow)} DEBT (80% of $10000)...`);
  try {
    await spotPool.connect(user).borrow(excessBorrow);
    console.log("[SpotOracle Pool] Borrow SUCCEEDED — $8000 extracted against $2000 real collateral!");
    logEvent("spot_borrow", { result: "success", amount: excessBorrow, realCollateralValue: realPrice });
  } catch (e) {
    console.log(`[SpotOracle Pool] Borrow FAILED: ${e.message}`);
    logEvent("spot_borrow", { result: "failed", reason: e.message });
  }

  // --- TWAPOracle pool: try same borrow ---
  await twapPool.connect(user).deposit(depositAmt);
  console.log(`\n[TWAPOracle Pool] Deposited 1 COL`);

  // Max borrow = 80% of TWAP value
  const twapCollateralValue = (depositAmt * twapP) / ONE;
  const maxTwapBorrow = (twapCollateralValue * 80n) / 100n;
  console.log(`[TWAPOracle Pool] TWAP collateral value: $${ethers.formatEther(twapCollateralValue)}`);
  console.log(`[TWAPOracle Pool] Max borrowable (80% LTV): $${ethers.formatEther(maxTwapBorrow)}`);

  console.log(`[TWAPOracle Pool] Attempting to borrow ${ethers.formatEther(excessBorrow)} DEBT...`);
  try {
    await twapPool.connect(user).borrow(excessBorrow);
    console.log("[TWAPOracle Pool] Borrow SUCCEEDED — TWAP was high enough");
    logEvent("twap_borrow_excess", { result: "success", amount: excessBorrow });
  } catch {
    console.log("[TWAPOracle Pool] Borrow FAILED — TWAP limited the borrowable amount");
    logEvent("twap_borrow_excess", { result: "failed", attempted: excessBorrow, maxAllowed: maxTwapBorrow });

    // Try borrowing at TWAP-allowed maximum
    const safeBorrow = maxTwapBorrow - ONE; // small buffer for rounding
    if (safeBorrow > 0n) {
      console.log(`[TWAPOracle Pool] Retrying with TWAP-safe amount: ${ethers.formatEther(safeBorrow)} DEBT...`);
      try {
        await twapPool.connect(user).borrow(safeBorrow);
        console.log(`[TWAPOracle Pool] Safe borrow SUCCEEDED: ${ethers.formatEther(safeBorrow)} DEBT`);
        logEvent("twap_borrow_safe", { result: "success", amount: safeBorrow });
      } catch (e2) {
        console.log(`[TWAPOracle Pool] Safe borrow also FAILED: ${e2.message}`);
        logEvent("twap_borrow_safe", { result: "failed", reason: e2.message });
      }
    }
  }

  // --- Summary ---
  const spotExcess = excessBorrow - (depositAmt * realPrice / ONE * 80n / 100n);
  console.log("\n=== Summary ===");
  console.log(`SpotOracle allowed borrowing $${ethers.formatEther(excessBorrow)} against $${ethers.formatEther(realPrice)} real collateral`);
  console.log(`  → Excess debt (protocol loss): $${ethers.formatEther(spotExcess)}`);
  console.log(`TWAPOracle max borrow: $${ethers.formatEther(maxTwapBorrow)} (vs Spot's $${ethers.formatEther(excessBorrow)})`);
  console.log(`  → TWAP reduced exploitable borrow by $${ethers.formatEther(excessBorrow - maxTwapBorrow)}`);

  logEvent("comparison_summary", {
    spotBorrowed: excessBorrow,
    twapMaxBorrow: maxTwapBorrow,
    spotExcessDebt: spotExcess,
    twapReduction: excessBorrow - maxTwapBorrow,
  });
}

async function main() {
  await runTwapInflatedPrice();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { runTwapInflatedPrice };
