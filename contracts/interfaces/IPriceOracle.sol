// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPriceOracle
 * @notice DeFi 预言机接口规范。
 * @dev 由 Dylan (Implementation Lead) 按照组员 A (Architecture Owner) 的规范进行初步实现。
 */
interface IPriceOracle {
    /**
     * @notice 获取资产的价格
     * @param asset 资产地址
     * @return price 价格（以 18 位小数表示，例如 1 ETH = 2000 USD，则返回 2000 * 10^18）
     */
    function getPrice(address asset) external view returns (uint256);
}
