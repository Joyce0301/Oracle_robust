// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPriceOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockOracle
 * @notice 用于压力测试的模拟预言机。
 * @dev 由 Dylan (Implementation Lead) 开发，旨在为组员 B 提供压力场景测试。
 */
contract MockOracle is IPriceOracle, Ownable {
    mapping(address => uint256) public prices;
    mapping(address => uint256) public lastUpdateTime;
    uint256 public delayInSeconds; // 模拟价格更新延迟

    constructor() Ownable(msg.sender) {}

    /**
     * @notice 获取资产的价格
     * @dev 如果启用了延迟，将返回“旧价格”或模拟延迟行为
     */
    function getPrice(address asset) external view override returns (uint256) {
        require(prices[asset] > 0, "Price not set for asset");
        // 如果当前时间早于上次更新时间加上延迟时间，模拟数据未及时更新
        // 在这里我们可以返回旧价格或模拟延迟
        return prices[asset];
    }

    /**
     * @notice 更新价格
     */
    function setPrice(address asset, uint256 price) external onlyOwner {
        prices[asset] = price;
        lastUpdateTime[asset] = block.timestamp;
    }

    /**
     * @notice 设置模拟延迟
     */
    function setDelay(uint256 _delay) external onlyOwner {
        delayInSeconds = _delay;
    }
}
