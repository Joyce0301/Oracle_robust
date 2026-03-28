const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("LendingPool", function () {
  let lendingPool;
  let collateralToken;
  let debtToken;
  let oracle;
  let owner, user, liquidator;

  const INITIAL_COLLATERAL_PRICE = ethers.parseEther("2000"); // 1 Collateral = 2000 USD
  const INITIAL_DEBT_PRICE = ethers.parseEther("1"); // 1 Debt = 1 USD

  beforeEach(async function () {
    [owner, user, liquidator] = await ethers.getSigners();

    // 部署模拟代币
    const MockToken = await ethers.getContractFactory("MockToken");
    collateralToken = await MockToken.deploy("Collateral", "COL");
    debtToken = await MockToken.deploy("Debt", "DEBT");

    // 部署预言机
    const SpotOracle = await ethers.getContractFactory("SpotOracle");
    oracle = await SpotOracle.deploy();

    // 初始化预言机价格
    await oracle.setPrice(await collateralToken.getAddress(), INITIAL_COLLATERAL_PRICE);
    await oracle.setPrice(await debtToken.getAddress(), INITIAL_DEBT_PRICE);

    // 部署借贷池
    const LendingPool = await ethers.getContractFactory("LendingPool");
    lendingPool = await LendingPool.deploy(
      await collateralToken.getAddress(),
      await debtToken.getAddress(),
      await oracle.getAddress()
    );

    // 给用户发放抵押品
    await collateralToken.mint(user.address, ethers.parseEther("10"));
    // 给清算人发放债务资产以便清算
    await debtToken.mint(liquidator.address, ethers.parseEther("20000"));

    // 用户批准借贷池使用抵押品
    await collateralToken.connect(user).approve(await lendingPool.getAddress(), ethers.parseEther("10"));
    // 清算人批准借贷池使用债务资产
    await debtToken.connect(liquidator).approve(await lendingPool.getAddress(), ethers.parseEther("20000"));
  });

  it("Should allow user to deposit collateral", async function () {
    const depositAmount = ethers.parseEther("1");
    await lendingPool.connect(user).deposit(depositAmount);
    expect(await lendingPool.collateralBalances(user.address)).to.equal(depositAmount);
  });

  it("Should allow user to borrow if collateral is sufficient", async function () {
    const depositAmount = ethers.parseEther("10"); // 10 COL * 2000 = 20000 USD
    const borrowAmount = ethers.parseEther("10000"); // 10000 DEBT * 1 = 10000 USD
    // LTV = 10000 / 20000 = 50%, 阈值为 80%

    await lendingPool.connect(user).deposit(depositAmount);
    
    // 我们需要先给借贷池充值借贷资产
    await debtToken.mint(await lendingPool.getAddress(), ethers.parseEther("100000"));

    await lendingPool.connect(user).borrow(borrowAmount);
    expect(await lendingPool.debtBalances(user.address)).to.equal(borrowAmount);
  });

  it("Should fail to borrow if collateral is insufficient", async function () {
    const depositAmount = ethers.parseEther("1"); // 1 COL * 2000 = 2000 USD
    const borrowAmount = ethers.parseEther("1700"); // 1700 / 2000 = 85% > 80%

    await lendingPool.connect(user).deposit(depositAmount);
    await expect(lendingPool.connect(user).borrow(borrowAmount)).to.be.revertedWith("Insufficient collateral");
  });

  it("Should allow liquidation when collateral value drops", async function () {
    const depositAmount = ethers.parseEther("1"); // 1 COL * 2000 = 2000 USD
    const borrowAmount = ethers.parseEther("1500"); // 1500 / 2000 = 75% < 80%

    await lendingPool.connect(user).deposit(depositAmount);
    await debtToken.mint(await lendingPool.getAddress(), ethers.parseEther("100000"));
    await lendingPool.connect(user).borrow(borrowAmount);

    // 模拟抵押品价格下跌：2000 -> 1800 USD
    // 新的债务比率：1500 / 1800 = 83.3% > 80%
    await oracle.setPrice(await collateralToken.getAddress(), ethers.parseEther("1800"));

    // 清算人清算用户
    await lendingPool.connect(liquidator).liquidate(user.address);

    expect(await lendingPool.collateralBalances(user.address)).to.equal(0);
    expect(await lendingPool.debtBalances(user.address)).to.equal(0);
  });
});

describe("TWAPOracle", function () {
  let collateralToken;
  let twapOracle;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MockToken");
    collateralToken = await MockToken.deploy("Collateral", "COL");

    const TWAPOracle = await ethers.getContractFactory("TWAPOracle");
    twapOracle = await TWAPOracle.deploy(3600);
  });

  it("Should return the latest price when there is no older observation in the window", async function () {
    const asset = await collateralToken.getAddress();
    const initialPrice = ethers.parseEther("2000");

    await twapOracle.pushPrice(asset, initialPrice);
    await time.increase(300);

    expect(await twapOracle.getPrice(asset)).to.equal(initialPrice);
  });

  it("Should smooth a sudden price move using a time-weighted average", async function () {
    const asset = await collateralToken.getAddress();
    const initialPrice = ethers.parseEther("2000");
    const shockedPrice = ethers.parseEther("1000");

    await twapOracle.pushPrice(asset, initialPrice);
    await time.increase(1800);
    await twapOracle.pushPrice(asset, shockedPrice);
    await time.increase(1800);

    expect(await twapOracle.getPrice(asset)).to.be.closeTo(
      ethers.parseEther("1500"),
      ethers.parseEther("1")
    );
  });
});
