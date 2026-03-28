// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPriceOracle.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TWAPOracle
 * @notice A simplified time-weighted average price oracle for stress testing.
 * @dev Prices use 18 decimals. The owner pushes spot prices and the contract
 *      derives an average across a configurable trailing window.
 */
contract TWAPOracle is IPriceOracle, Ownable {
    struct Observation {
        uint256 timestamp;
        uint256 cumulativePrice;
    }

    struct AssetState {
        uint256 lastPrice;
        uint256 lastTimestamp;
        uint256 cumulativePrice;
        bool initialized;
    }

    uint256 public immutable windowSize;

    mapping(address => AssetState) public assetStates;
    mapping(address => Observation[]) private observations;

    event PricePushed(address indexed asset, uint256 price, uint256 timestamp);

    constructor(uint256 _windowSize) Ownable(msg.sender) {
        require(_windowSize > 0, "Window must be > 0");
        windowSize = _windowSize;
    }

    function pushPrice(address asset, uint256 price) external onlyOwner {
        require(asset != address(0), "Invalid asset");
        require(price > 0, "Price must be > 0");

        AssetState storage state = assetStates[asset];
        uint256 currentTimestamp = block.timestamp;

        if (!state.initialized) {
            state.initialized = true;
            state.lastPrice = price;
            state.lastTimestamp = currentTimestamp;
            observations[asset].push(
                Observation({timestamp: currentTimestamp, cumulativePrice: 0})
            );
            emit PricePushed(asset, price, currentTimestamp);
            return;
        }

        require(currentTimestamp >= state.lastTimestamp, "Invalid timestamp");

        uint256 elapsed = currentTimestamp - state.lastTimestamp;
        if (elapsed > 0) {
            state.cumulativePrice += state.lastPrice * elapsed;
            observations[asset].push(
                Observation({
                    timestamp: currentTimestamp,
                    cumulativePrice: state.cumulativePrice
                })
            );
        }

        state.lastPrice = price;
        state.lastTimestamp = currentTimestamp;

        emit PricePushed(asset, price, currentTimestamp);
    }

    function getPrice(address asset) external view override returns (uint256) {
        AssetState storage state = assetStates[asset];
        require(state.initialized, "Price not set for asset");

        uint256 currentTimestamp = block.timestamp;
        uint256 currentCumulative = state.cumulativePrice;
        uint256 elapsedSinceLastUpdate = currentTimestamp - state.lastTimestamp;

        if (elapsedSinceLastUpdate > 0) {
            currentCumulative += state.lastPrice * elapsedSinceLastUpdate;
        }

        Observation[] storage assetObservations = observations[asset];
        require(assetObservations.length > 0, "No observations");

        uint256 targetTimestamp = currentTimestamp > windowSize
            ? currentTimestamp - windowSize
            : 0;

        Observation storage oldest = assetObservations[0];
        Observation storage selected = oldest;

        for (uint256 i = assetObservations.length; i > 0; i--) {
            Observation storage candidate = assetObservations[i - 1];
            if (candidate.timestamp <= targetTimestamp) {
                selected = candidate;
                break;
            }
        }

        uint256 averagingStart = selected.timestamp;
        if (averagingStart == currentTimestamp) {
            return state.lastPrice;
        }

        uint256 averagingPeriod = currentTimestamp - averagingStart;
        require(averagingPeriod > 0, "Insufficient history");

        uint256 cumulativeDelta = currentCumulative - selected.cumulativePrice;
        return cumulativeDelta / averagingPeriod;
    }

    function getLatestPrice(address asset) external view returns (uint256) {
        AssetState storage state = assetStates[asset];
        require(state.initialized, "Price not set for asset");
        return state.lastPrice;
    }

    function getObservationCount(address asset) external view returns (uint256) {
        return observations[asset].length;
    }
}
