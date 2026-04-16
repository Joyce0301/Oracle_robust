// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/// @title Oracle Interface Specification (IOracle)
/// @author Wenyi XU (Architecture/Spec Owner)
/// @notice All oracle implementations in this project must adhere to this interface
/// @dev Supports single asset pricing, multi-source aggregation, and mock mode
interface IOracle {
    /* ========== STRUCTS ========== */

    /// @notice Price data format
    /// @param price Asset price, typically denominated in USD, with precision defined by the specific implementation (e.g., 1e8)
    /// @param timestamp The latest update time for this price (Unix timestamp)
    /// @param source Data source identifier (e.g., "chainlink", "uniswap-twap", "mock")
    struct Price {
        uint256 price;
        uint256 timestamp;
        string source;
    }

    /* ========== EVENTS ========== */

    /// @notice Emitted when a price is updated (optional, for monitoring purposes)
    event PriceUpdated(address indexed asset, uint256 price, uint256 timestamp, string source);

    /// @notice Emitted when an abnormal price fluctuation is detected (for threat detection)
    event PriceDeviationDetected(address indexed asset, uint256 newPrice, uint256 oldPrice, uint256 thresholdBps);

    /* ========== CORE FUNCTIONS ========== */

    /// @notice Get the latest price for a specified asset
    /// @param asset Asset address (e.g., ERC20 token address)
    /// @return price The asset price
    /// @return timestamp The timestamp of the price update
    /// @dev Must ensure the returned price is validated and not raw, unprocessed data
    function getPrice(address asset) external view returns (uint256 price, uint256 timestamp);

    /// @notice Batch get the latest prices for multiple assets
    /// @param assets Array of asset addresses
    /// @return prices Array of prices
    /// @return timestamps Array of timestamps
    /// @dev Used to optimize gas costs for multi-asset protocols
    function getPrices(address[] calldata assets)
        external
        view
        returns (uint256[] memory prices, uint256[] memory timestamps);

    /// @notice Get the historical price for a specified asset (optional, for TWAP, etc.)
    /// @param asset Asset address
    /// @param lookupTimestamp The point in time to query (Unix timestamp)
    /// @return price The approximate price at that point in time
    /// @dev If the implementation does not support historical prices, it should revert to the current price and emit a warning
    function getHistoricalPrice(address asset, uint256 lookupTimestamp)
        external
        view
        returns (uint256 price, uint256 timestamp);

    /* ========== ADMIN / CONFIG FUNCTIONS ========== */

    /// @notice Set the price source for an asset (for multi-source aggregation or testing/mock)
    /// @param asset Asset address
    /// @param source Address of the data source (e.g., Chainlink oracle contract address)
    /// @param isPrimary Whether this is the primary data source
    /// @dev Only callable by the contract owner, used for dynamic configuration
    function setPriceSource(address asset, address source, bool isPrimary) external;

    /// @notice Enable/disable mock mode (for stress testing)
    /// @param enabled Whether to enable mock mode
    /// @dev In mock mode, prices can be directly pushed up/down by test scripts
    function setMockMode(bool enabled) external;

    /// @notice Directly set a price in mock mode (only available when mock mode is enabled)
    /// @param asset Asset address
    /// @param price The price to set
    /// @dev Used for price manipulation scenarios in stress tests
    function setMockPrice(address asset, uint256 price) external;

    /* ========== VIEW FUNCTIONS FOR INVARIANTS ========== */

    /// @notice Get the number of data sources for an asset's price (for multi-source redundancy checks)
    /// @param asset Asset address
    /// @return count Number of data sources
    function sourceCount(address asset) external view returns (uint256);

    /// @notice Check if an asset's price is considered "fresh" (recently updated)
    /// @param asset Asset address
    /// @param maxAge Maximum allowed delay (in seconds)
    /// @return isFresh Whether the price is fresh
    function isPriceFresh(address asset, uint256 maxAge) external view returns (bool);
}