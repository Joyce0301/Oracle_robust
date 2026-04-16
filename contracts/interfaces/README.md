# IOracle.sol — DeFi Oracle Interface Specification

## 🧩 Interface Components

### 1. Data Structure `Price`

```solidity
struct Price {
    uint256 price;      // Asset price (e.g., 1e8 precision)
    uint256 timestamp;  // Update timestamp (Unix)
    string source;      // Data source identifier (e.g., "chainlink")
}
```

### 2. Events

| Event | Trigger Condition | Purpose |
|-------|-------------------|---------|
| `PriceUpdated` | When price is updated | Monitoring and logging |
| `PriceDeviationDetected` | When price fluctuation exceeds threshold | Threat detection |

### 3. Core Query Functions

| Function | Description |
|----------|-------------|
| `getPrice(address)` | Get the latest price for a single asset |
| `getPrices(address[])` | Batch get prices for multiple assets |
| `getHistoricalPrice(address, uint256)` | Get historical price (optional implementation) |

### 4. Administration & Configuration Functions

| Function | Description | Purpose |
|----------|-------------|---------|
| `setPriceSource(address, address, bool)` | Configure data source for an asset | Multi-source aggregation |
| `setMockMode(bool)` | Enable/disable mock mode | Stress testing |
| `setMockPrice(address, uint256)` | Directly set a mock price | Price manipulation simulation |

### 5. Invariant Check Functions

| Function | Description |
|----------|-------------|
| `sourceCount(address)` | Get the number of data sources for an asset |
| `isPriceFresh(address, uint256)` | Check if price is fresh (not stale) |

---

## 🔄 Mapping to Threat Models

| Threat | Corresponding Interface Capability |
|--------|-------------------------------------|
| Price manipulation | `setMockPrice` to simulate attacks, `PriceDeviationDetected` for monitoring |
| Stale updates | `isPriceFresh` to check freshness |
| Single point of failure | `sourceCount` to check redundancy, `setPriceSource` for dynamic switching |
| Multi-source inconsistency | `getPrice` can aggregate data from multiple sources |
| Lack of historical reference | `getHistoricalPrice` supports TWAP |

---

## 🧪 Testing Support Instructions

### Mock Mode
```solidity
oracle.setMockMode(true);
oracle.setMockPrice(asset, 100 * 1e8); // Set price to $100
```

### Freshness Check
```solidity
require(oracle.isPriceFresh(asset, 1 hours), "Price stale");
```

### Abnormal Fluctuation Monitoring
Listen for the `PriceDeviationDetected` event, record fluctuation magnitude and time.

---

## 📂 File Location

```
contracts/
└── interfaces/
    └── IOracle.sol          # Oracle interface specification
```

Implementation classes are recommended to be placed in:
```
contracts/
└── oracles/
    ├── ChainlinkOracle.sol  # Chainlink-based implementation
    ├── TWAPOracle.sol       # Uniswap TWAP-based implementation
    └── MockOracle.sol       # Mock oracle (for testing)
```

---

## ✅ Implementation Checklist

Contracts implementing `IOracle` must:

- [ ] Implement `getPrice` and `getPrices`
- [ ] Ensure returned prices are validated (not raw data)
- [ ] Optionally emit `PriceUpdated` when prices are updated
- [ ] Emit `PriceDeviationDetected` when price fluctuation exceeds threshold
- [ ] Support `isPriceFresh` checks
- [ ] Support multi-asset configuration (at minimum, configurable via `setPriceSource`)

---

## 👥 Team Collaboration Guidelines

| Role | How to Use This Interface |
|------|---------------------------|
| **Member D (Implementer)** | Implement at least two versions of Oracle (e.g., ChainlinkOracle and MockOracle) |
| **Member B (Tester)** | Simulate price manipulation via `setMockPrice`, check for delays via `isPriceFresh` |
| **Member C (Analyst)** | Listen for `PriceDeviationDetected` events, extract abnormal fluctuation data |
| **(Member A)** | Maintain the interface specification, ensure all implementations adhere to this interface |

---