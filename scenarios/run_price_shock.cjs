const { ethers } = require("hardhat");
const { loadAddresses, readScenarioParams } = require("./lib/config.cjs");
const { logEvent } = require("./lib/logger.cjs");

async function main() {
  const { filePath, addresses } = loadAddresses();
  const [operator, borrower, liquidator] = await ethers.getSigners();
  const params = readScenarioParams({
    depositAmount: "1",
    borrowAmount: "1500",
    shockedCollateralPrice: "1800",
  });

  const collateralToken = await ethers.getContractAt("MockToken", addresses.collateralToken);
  const debtToken = await ethers.getContractAt("MockToken", addresses.debtToken);
  const oracle = await ethers.getContractAt("SpotOracle", addresses.spotOracle);
  const lendingPool = await ethers.getContractAt("LendingPool", addresses.lendingPool);

  const depositAmount = ethers.parseEther(params.depositAmount);
  const borrowAmount = ethers.parseEther(params.borrowAmount);
  const shockedCollateralPrice = ethers.parseEther(params.shockedCollateralPrice);

  logEvent("scenario_start", {
    scenario: "price_shock",
    deploymentFile: filePath,
    operator: operator.address,
    borrower: borrower.address,
    liquidator: liquidator.address,
    params,
  });

  await collateralToken.mint(borrower.address, depositAmount);
  await debtToken.mint(liquidator.address, borrowAmount);

  await collateralToken.connect(borrower).approve(await lendingPool.getAddress(), depositAmount);
  await debtToken.connect(liquidator).approve(await lendingPool.getAddress(), borrowAmount);

  await lendingPool.connect(borrower).deposit(depositAmount);
  await lendingPool.connect(borrower).borrow(borrowAmount);

  logEvent("position_opened", {
    collateralBalance: await lendingPool.collateralBalances(borrower.address),
    debtBalance: await lendingPool.debtBalances(borrower.address),
  });

  await oracle.setPrice(addresses.collateralToken, shockedCollateralPrice);
  logEvent("oracle_shocked", {
    collateralPrice: await oracle.getPrice(addresses.collateralToken),
    debtPrice: await oracle.getPrice(addresses.debtToken),
  });

  await lendingPool.connect(liquidator).liquidate(borrower.address);
  logEvent("position_liquidated", {
    collateralBalance: await lendingPool.collateralBalances(borrower.address),
    debtBalance: await lendingPool.debtBalances(borrower.address),
  });
}

main().catch((error) => {
  logEvent("scenario_error", { message: error.message });
  console.error(error);
  process.exitCode = 1;
});
