/**
 * Baseline: deploy LendingPool with MockOracle instead of SpotOracle.
 * MockOracle records lastUpdateTime / delayInSeconds but getPrice() still returns the stored price
 * (delay not applied) — useful documentation for future stress tests once delay is wired.
 *
 * Run: npx hardhat run scenarios/mock_oracle_baseline.cjs
 */
const { ethers } = require("hardhat");
const { POOL_LIQUIDITY } = require("./_fixture.cjs");
const { logEvent } = require("./lib/logger.cjs");

async function runMockOracleBaseline() {
  const [deployer, user] = await ethers.getSigners();

  const MockToken = await ethers.getContractFactory("MockToken");
  const collateral = await MockToken.deploy("Collateral", "COL");
  const debt = await MockToken.deploy("Debt", "DEBT");
  await collateral.waitForDeployment();
  await debt.waitForDeployment();

  const MockOracle = await ethers.getContractFactory("MockOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();

  const cAddr = await collateral.getAddress();
  const dAddr = await debt.getAddress();
  await oracle.setPrice(cAddr, ethers.parseEther("2000"));
  await oracle.setPrice(dAddr, ethers.parseEther("1"));
  await oracle.setDelay(3600);

  const LendingPool = await ethers.getContractFactory("LendingPool");
  const pool = await LendingPool.deploy(cAddr, dAddr, await oracle.getAddress());
  await pool.waitForDeployment();
  await debt.mint(await pool.getAddress(), POOL_LIQUIDITY);

  const p = await oracle.getPrice(cAddr);
  const delay = await oracle.delayInSeconds();
  console.log("--- MockOracle baseline ---");
  console.log(`getPrice(COL) = ${ethers.formatEther(p)} (delay=${delay.toString()}s, not enforced in getPrice yet)`);
  console.log("Next step for scenarios: implement stale-price behavior in MockOracle.getPrice, then replay flash_crash with delayed updates.");

  logEvent("mock_oracle_baseline", { collateralPrice: p, delaySeconds: delay, delayEnforced: false });
}

async function main() {
  await runMockOracleBaseline();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { runMockOracleBaseline };
