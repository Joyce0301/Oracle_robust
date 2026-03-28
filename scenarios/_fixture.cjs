/**
 * Shared deployment for stress scenarios (Member B).
 * Mirrors deploy_mvp.cjs with extra signers and higher pool liquidity for large borrows.
 */
const { ethers } = require("hardhat");

const DEFAULT_COLLATERAL_PRICE = ethers.parseEther("2000");
const DEFAULT_DEBT_PRICE = ethers.parseEther("1");
const POOL_LIQUIDITY = ethers.parseEther("1000000");

async function deployStressFixture() {
  const [deployer, user, liquidator] = await ethers.getSigners();

  const MockToken = await ethers.getContractFactory("MockToken");
  const collateral = await MockToken.deploy("Collateral", "COL");
  const debt = await MockToken.deploy("Debt", "DEBT");
  await collateral.waitForDeployment();
  await debt.waitForDeployment();

  const SpotOracle = await ethers.getContractFactory("SpotOracle");
  const oracle = await SpotOracle.deploy();
  await oracle.waitForDeployment();

  const collateralAddr = await collateral.getAddress();
  const debtAddr = await debt.getAddress();
  const oracleAddr = await oracle.getAddress();

  await oracle.setPrice(collateralAddr, DEFAULT_COLLATERAL_PRICE);
  await oracle.setPrice(debtAddr, DEFAULT_DEBT_PRICE);

  const LendingPool = await ethers.getContractFactory("LendingPool");
  const pool = await LendingPool.deploy(collateralAddr, debtAddr, oracleAddr);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();

  await debt.mint(poolAddr, POOL_LIQUIDITY);

  return {
    deployer,
    user,
    liquidator,
    collateral,
    debt,
    oracle,
    pool,
    collateralAddr,
    debtAddr,
    oracleAddr,
    poolAddr,
    DEFAULT_COLLATERAL_PRICE,
    DEFAULT_DEBT_PRICE,
  };
}

function formatUsdFrom18(x) {
  return ethers.formatEther(x);
}

module.exports = {
  deployStressFixture,
  formatUsdFrom18,
  POOL_LIQUIDITY,
};
