// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IPriceOracle.sol";

/**
 * @title LendingPool
 * @notice 简化的借贷协议原型，用于测试 Oracle 在压力下的表现。
 * @dev 由 Dylan (Implementation Lead) 开发。
 */
contract LendingPool is Ownable {
    // 抵押资产和借贷资产的地址
    address public collateralAsset;
    address public debtAsset;

    // 预言机接口
    IPriceOracle public priceOracle;

    // 清算阈值 (LTV) - 10^18 表示 100%
    uint256 public constant LIQUIDATION_THRESHOLD = 0.8 * 1e18; // 80%

    // 用户的抵押品余额和债务余额
    mapping(address => uint256) public collateralBalances;
    mapping(address => uint256) public debtBalances;

    event Deposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator, uint256 amount);

    constructor(address _collateralAsset, address _debtAsset, address _oracle) Ownable(msg.sender) {
        collateralAsset = _collateralAsset;
        debtAsset = _debtAsset;
        priceOracle = IPriceOracle(_oracle);
    }

    /**
     * @notice 存入抵押品
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        IERC20(collateralAsset).transferFrom(msg.sender, address(this), amount);
        collateralBalances[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice 借入资产
     */
    function borrow(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        
        // 检查用户是否有足够的抵押品价值
        uint256 collateralPrice = priceOracle.getPrice(collateralAsset);
        uint256 debtPrice = priceOracle.getPrice(debtAsset);

        uint256 collateralValue = (collateralBalances[msg.sender] * collateralPrice) / 1e18;
        uint256 currentDebtValue = (debtBalances[msg.sender] * debtPrice) / 1e18;
        uint256 newDebtValue = currentDebtValue + ((amount * debtPrice) / 1e18);

        require(newDebtValue <= (collateralValue * LIQUIDATION_THRESHOLD) / 1e18, "Insufficient collateral");

        debtBalances[msg.sender] += amount;
        IERC20(debtAsset).transfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    /**
     * @notice 偿还债务
     */
    function repay(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        IERC20(debtAsset).transferFrom(msg.sender, address(this), amount);
        debtBalances[msg.sender] -= amount;
        emit Repaid(msg.sender, amount);
    }

    /**
     * @notice 清算用户的头寸
     * @param user 被清算的用户
     */
    function liquidate(address user) external {
        uint256 collateralPrice = priceOracle.getPrice(collateralAsset);
        uint256 debtPrice = priceOracle.getPrice(debtAsset);

        uint256 collateralValue = (collateralBalances[user] * collateralPrice) / 1e18;
        uint256 debtValue = (debtBalances[user] * debtPrice) / 1e18;

        // 检查用户是否已经跌破清算线
        require(debtValue > (collateralValue * LIQUIDATION_THRESHOLD) / 1e18, "Position is healthy");

        // 清算逻辑：清算人偿还债务，获得用户的全部抵押品
        uint256 userDebt = debtBalances[user];
        uint256 userCollateral = collateralBalances[user];

        IERC20(debtAsset).transferFrom(msg.sender, address(this), userDebt);
        IERC20(collateralAsset).transfer(msg.sender, userCollateral);

        debtBalances[user] = 0;
        collateralBalances[user] = 0;

        emit Liquidated(user, msg.sender, userDebt);
    }

    /**
     * @notice 更新预言机
     */
    function setPriceOracle(address _oracle) external onlyOwner {
        priceOracle = IPriceOracle(_oracle);
    }
}
