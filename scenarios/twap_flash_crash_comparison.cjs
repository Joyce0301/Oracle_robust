/**
 * Stress scenario: SpotOracle vs TWAPOracle under identical flash crash.
 *
 * Deploys two LendingPools (one with SpotOracle, one with TWAPOracle).
 * Opens identical positions, crashes the collateral price, and compares:
 *   - SpotOracle pool: liquidation succeeds immediately
 *   - TWAPOracle pool: TWAP smooths the drop; liquidation may fail until enough time passes
 *
 * Run: npx hardhat run scenarios/twap_flash_crash_comparison.cjs
 */
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { logEvent } = require("./lib/logger.cjs");

const ONE = ethers.parseEther("1");
const TWAP_WINDOW = 1800; // 30 minutes

async function runTwapFlashCrashComparison() {
  const [deployer, user, liquidator] = await ethers.getSigners();

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

  const initialPrice = ethers.parseEther("2000");
  const crashPrice = ethers.parseEther("1800");
  await spotOracle.setPrice(cAddr, initialPrice);
  await spotOracle.setPrice(dAddr, ONE);
  await twapOracle.pushPrice(cAddr, initialPrice);
  await twapOracle.pushPrice(dAddr, ONE);

  // Let TWAP accumulate some history at the initial price
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
  const borrowAmt = ethers.parseEther("1500");

  await collateral.mint(user.address, ethers.parseEther("10"));
  await debt.mint(liquidator.address, ethers.parseEther("500000"));

  const spotPoolAddr = await spotPool.getAddress();
  const twapPoolAddr = await twapPool.getAddress();
  await collateral.connect(user).approve(spotPoolAddr, depositAmt);
  await collateral.connect(user).approve(twapPoolAddr, depositAmt);
  await debt.connect(liquidator).approve(spotPoolAddr, ethers.parseEther("250000"));
  await debt.connect(liquidator).approve(twapPoolAddr, ethers.parseEther("250000"));

  // Open identical positions in both pools
  await spotPool.connect(user).deposit(depositAmt);
  await spotPool.connect(user).borrow(borrowAmt);
  await twapPool.connect(user).deposit(depositAmt);
  await twapPool.connect(user).borrow(borrowAmt);

  console.log("=== TWAP vs Spot Flash Crash Comparison ===");
  console.log(`Deposit: ${ethers.formatEther(depositAmt)} COL, Borrow: ${ethers.formatEther(borrowAmt)} DEBT`);
  console.log(`Initial price: ${ethers.formatEther(initialPrice)} USD, Crash price: ${ethers.formatEther(crashPrice)} USD`);
  console.log(`TWAP window: ${TWAP_WINDOW}s\n`);

  logEvent("scenario_start", { scenario: "twap_flash_crash_comparison", initialPrice, crashPrice, twapWindow: TWAP_WINDOW });

  // --- Crash the price ---
  await spotOracle.setPrice(cAddr, crashPrice);
  await twapOracle.pushPrice(cAddr, crashPrice);

  const spotPriceAfterCrash = await spotOracle.getPrice(cAddr);
  const twapPriceAfterCrash = await twapOracle.getPrice(cAddr);

  console.log("--- Immediately after crash ---");
  console.log(`SpotOracle getPrice: ${ethers.formatEther(spotPriceAfterCrash)} USD`);
  console.log(`TWAPOracle getPrice: ${ethers.formatEther(twapPriceAfterCrash)} USD (smoothed)`);

  logEvent("oracle_shocked", { spotPrice: spotPriceAfterCrash, twapPrice: twapPriceAfterCrash });

  // --- SpotOracle pool: liquidation should succeed ---
  console.log("\n[SpotOracle Pool] Attempting liquidation...");
  try {
    await spotPool.connect(liquidator).liquidate(user.address);
    console.log("[SpotOracle Pool] Liquidation SUCCEEDED (position was unhealthy)");
    logEvent("spot_liquidation", { result: "success" });
  } catch (e) {
    console.log(`[SpotOracle Pool] Liquidation FAILED: ${e.message}`);
    logEvent("spot_liquidation", { result: "failed", reason: e.message });
  }

  // --- TWAPOracle pool: liquidation should fail (TWAP still above threshold) ---
  console.log("\n[TWAPOracle Pool] Attempting liquidation immediately...");
  let twapLiquidatedEarly = false;
  try {
    await twapPool.connect(liquidator).liquidate(user.address);
    console.log("[TWAPOracle Pool] Liquidation SUCCEEDED immediately (TWAP dropped fast enough)");
    twapLiquidatedEarly = true;
    logEvent("twap_liquidation_immediate", { result: "success" });
  } catch (e) {
    console.log("[TWAPOracle Pool] Liquidation FAILED (position still healthy under TWAP)");
    logEvent("twap_liquidation_immediate", { result: "failed", twapPrice: twapPriceAfterCrash });
  }

  // --- Advance time and retry until TWAP catches up ---
  if (!twapLiquidatedEarly) {
    const steps = [300, 600, 900, 1200, 1500, 1800];
    let liquidated = false;
    for (const stepSec of steps) {
      await time.increase(stepSec);
      const currentTwap = await twapOracle.getPrice(cAddr);
      console.log(`\n  +${stepSec}s elapsed → TWAP price: ${ethers.formatEther(currentTwap)} USD`);
      try {
        await twapPool.connect(liquidator).liquidate(user.address);
        console.log(`  [TWAPOracle Pool] Liquidation SUCCEEDED after +${stepSec}s`);
        logEvent("twap_liquidation_delayed", { result: "success", delaySeconds: stepSec, twapPrice: currentTwap });
        liquidated = true;
        break;
      } catch {
        console.log("  [TWAPOracle Pool] Still healthy...");
      }
    }
    if (!liquidated) {
      console.log("\n  [TWAPOracle Pool] Position remained healthy through entire observation window.");
      logEvent("twap_liquidation_delayed", { result: "never_triggered" });
    }
  }

  console.log("\n=== Conclusion ===");
  console.log("SpotOracle: instant liquidation on price change.");
  console.log("TWAPOracle: liquidation delayed — TWAP smooths the price drop, giving borrowers a buffer window.");
}

async function main() {
  await runTwapFlashCrashComparison();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { runTwapFlashCrashComparison };
