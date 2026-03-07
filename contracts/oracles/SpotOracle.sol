// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPriceOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SpotOracle
 * @notice 模拟即时价格的预言机，允许管理员更新价格以模拟市场波动。
 * @dev 由 Dylan (Implementation Lead) 开发。
 */
contract SpotOracle is IPriceOracle, Ownable {
    mapping(address => uint256) public prices;

    constructor() Ownable(msg.sender) {}

    /**
     * @notice 获取资产的价格
     */
    function getPrice(address asset) external view override returns (uint256) {
        require(prices[asset] > 0, "Price not set for asset");
        return prices[asset];
    }

    /**
     * @notice 管理员更新价格，模拟外部数据源更新
     */
    function setPrice(address asset, uint256 price) external onlyOwner {
        prices[asset] = price;
    }
}
