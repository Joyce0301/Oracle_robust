const { ethers } = require("hardhat");

async function main() {
  console.log("Starting MVP deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. 部署模拟代币
  console.log("Deploying MockTokens...");
  const MockToken = await ethers.getContractFactory("MockToken");
  const collateralToken = await MockToken.deploy("Collateral Token", "COL");
  const debtToken = await MockToken.deploy("Debt Token", "DEBT");

  await collateralToken.waitForDeployment();
  await debtToken.waitForDeployment();

  const collateralAddr = await collateralToken.getAddress();
  const debtAddr = await debtToken.getAddress();
  console.log(`Collateral Token deployed to: ${collateralAddr}`);
  console.log(`Debt Token deployed to: ${debtAddr}`);

  // 2. 部署预言机
  console.log("Deploying SpotOracle...");
  const SpotOracle = await ethers.getContractFactory("SpotOracle");
  const oracle = await SpotOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log(`SpotOracle deployed to: ${oracleAddr}`);

  // 3. 初始化价格
  const initialCollateralPrice = ethers.parseEther("2000"); // 1 COL = 2000 USD
  const initialDebtPrice = ethers.parseEther("1"); // 1 DEBT = 1 USD
  await oracle.setPrice(collateralAddr, initialCollateralPrice);
  await oracle.setPrice(debtAddr, initialDebtPrice);
  console.log("Initial prices set in oracle.");

  // 4. 部署借贷池
  console.log("Deploying LendingPool...");
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(collateralAddr, debtAddr, oracleAddr);
  await lendingPool.waitForDeployment();
  const poolAddr = await lendingPool.getAddress();
  console.log(`LendingPool deployed to: ${poolAddr}`);

  // 5. 为借贷池充值借贷资产，以便用户借款
  const initialPoolLiquidity = ethers.parseEther("100000");
  await debtToken.mint(poolAddr, initialPoolLiquidity);
  console.log(`Funded LendingPool with ${ethers.formatEther(initialPoolLiquidity)} DEBT.`);

  console.log("\nDeployment completed successfully!");
  console.log("-----------------------------------");
  console.log(`COLLATERAL_TOKEN=${collateralAddr}`);
  console.log(`DEBT_TOKEN=${debtAddr}`);
  console.log(`PRICE_ORACLE=${oracleAddr}`);
  console.log(`LENDING_POOL=${poolAddr}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
