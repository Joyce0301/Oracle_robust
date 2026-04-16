# Threat-to-Test Mapping Table

## 🔗 Threat → Test Mapping Overview

| Threat ID | Threat Description | Test Scenario ID | Test Script |
|-----------|--------------------|------------------|-------------|
| T-01 | Flash loan price manipulation | S-01 | `scenarios/flashloan-attack.js` |
| T-02 | Oracle stale price | S-02 | `scenarios/stale-price.js` |
| T-03 | Multi-source data inconsistency | S-03 | `scenarios/source-divergence.js` |
| T-04 | Flash crash price jump | S-04 | `scenarios/flash-crash.js` |
| T-05 | Single source failure | S-05 | `scenarios/single-source-failure.js` |
| T-06 | Price manipulation + liquidation arbitrage | S-06 | `scenarios/liquidation-exploit.js` |
| T-07 | Price distortion under low liquidity | S-07 | `scenarios/low-liquidity-manipulation.js` |
| T-08 | Malicious oracle node | S-08 | `scenarios/malicious-oracle-node.js` |
| T-09 | Multi-block price manipulation | S-09 | `scenarios/multi-block-manipulation.js` |

---

## 📊 Detailed Mapping Table

### T-01: Flash Loan Price Manipulation
**Threat Description**: Attackers borrow large amounts of funds via flash loans to manipulate spot prices on low-liquidity DEXes, causing oracles that rely on spot prices to output incorrect values.

| Mapping Item | Content |
|--------------|---------|
| **Test Scenario ID** | S-01 |
| **Test Script** | `scenarios/flashloan-attack.js` |
| **Test Description** | Use a flash loan to significantly push up/down asset prices in a Uniswap V3 pool and observe whether the oracle price is manipulated |
| **Prerequisites** | - Deploy MockOracle or ChainlinkOracle<br>- Deploy a simplified lending protocol<br>- Set up asset collateral |
| **Test Steps** | 1. Attacker initiates a flash loan<br>2. Executes a large swap on DEX<br>3. Calls oracle `getPrice`<br>4. Attempts to exploit the incorrect price for liquidation |
| **Expected Results** | - If oracle is spot-based → price manipulated → triggers incorrect liquidation<br>- If oracle is TWAP-based → price smoothed → resists manipulation |
| **Metrics** | - Price deviation (%): manipulated price vs. real price<br>- Liquidation trigger rate<br>- Attacker profit |
| **Acceptance Criteria** | Script can output price change curve and liquidation event logs |

---

### T-02: Oracle Stale Price
**Threat Description**: During rapid market volatility, the oracle fails to update prices in time, causing the protocol to use stale prices for liquidations.

| Mapping Item | Content |
|--------------|---------|
| **Test Scenario ID** | S-02 |
| **Test Script** | `scenarios/stale-price.js` |
| **Test Description** | Simulate rapid external market price decline while oracle updates are delayed |
| **Prerequisites** | - Deploy ChainlinkOracle (simulate heartbeat delay)<br>- Set `maxAge = 1 hour` |
| **Test Steps** | 1. External market price drops 30%<br>2. Pause oracle updates (simulate node failure)<br>3. User health factor drops below liquidation threshold<br>4. Check if protocol uses stale price |
| **Expected Results** | - If `isPriceFresh` check fails → incorrect liquidation<br>- If freshness check exists → pause liquidation or trigger fallback mechanism |
| **Metrics** | - Price update timestamp deviation<br>- Number of incorrect liquidations<br>- Bad debt amount |
| **Acceptance Criteria** | Script can record timestamp and delay for each price query |

---

### T-03: Multi-source Data Inconsistency
**Threat Description**: Chainlink price feed significantly diverges from Uniswap TWAP, leaving the protocol unsure which source to trust.

| Mapping Item | Content |
|--------------|---------|
| **Test Scenario ID** | S-03 |
| **Test Script** | `scenarios/source-divergence.js` |
| **Test Description** | Simulate price difference between Chainlink and Uniswap exceeding threshold |
| **Prerequisites** | - Deploy aggregation oracle (relying on multiple sources)<br>- Set deviation threshold to 5% |
| **Test Steps** | 1. Manipulate Uniswap price away from Chainlink<br>2. Deviation exceeds 5%<br>3. Observe aggregation oracle behavior |
| **Expected Results** | - Aggregator pauses updates or triggers alert<br>- Lending protocol falls back to safe mode |
| **Metrics** | - Deviation percentage<br>- Whether protocol triggers circuit breaker |
| **Acceptance Criteria** | Script can read from both sources simultaneously and calculate deviation |

---

### T-04: Flash Crash Price Jump
**Threat Description**: Asset price plummets 50%+ in a short time, testing oracle and protocol response capabilities.

| Mapping Item | Content |
|--------------|---------|
| **Test Scenario ID** | S-04 |
| **Test Script** | `scenarios/flash-crash.js` |
| **Test Description** | Simulate a LUNA-like crash price curve |
| **Prerequisites** | - Deploy MockOracle (supports time-series price pushing) |
| **Test Steps** | 1. Push prices down by time step (e.g., -10% per block)<br>2. Record liquidation events after each price update<br>3. Observe if liquidation cascade occurs |
| **Expected Results** | - Protocol should liquidate gradually, not all at once<br>- Bad debt rate should be controllable |
| **Metrics** | - Liquidation cascade depth (consecutive liquidations)<br>- Pool loss |
| **Acceptance Criteria** | Script can output price-time curve and liquidation waterfall chart |

---

### T-05: Single Source Failure
**Threat Description**: The single data source (e.g., a specific node) that the oracle relies on goes offline, preventing price updates.

| Mapping Item | Content |
|--------------|---------|
| **Test Scenario ID** | S-05 |
| **Test Script** | `scenarios/single-source-failure.js` |
| **Test Description** | Simulate all Chainlink nodes going offline |
| **Prerequisites** | - Deploy Oracle with only a single data source |
| **Test Steps** | 1. Stop all node updates<br>2. Wait beyond `maxAge`<br>3. Call `isPriceFresh`<br>4. Attempt lending operations |
| **Expected Results** | - No redundancy → price becomes stale → protocol pauses<br>- With redundancy → switch to backup source |
| **Metrics** | - Price update delay<br>- Whether protocol pauses |
| **Acceptance Criteria** | Script can simulate node downtime and verify protocol behavior |

---

### T-06: Price Manipulation + Liquidation Arbitrage
**Threat Description**: Attackers first manipulate prices to trigger liquidations, then buy liquidated assets at a discount for profit.

| Mapping Item | Content |
|--------------|---------|
| **Test Scenario ID** | S-06 |
| **Test Script** | `scenarios/liquidation-exploit.js` |
| **Test Description** | Complete attack path combining price manipulation and liquidation arbitrage |
| **Prerequisites** | - Deploy lending protocol<br>- Deploy MockOracle |
| **Test Steps** | 1. Attacker manipulates price to put target account into liquidation<br>2. Attacker profits as liquidator<br>3. After price recovers, calculate net profit |
| **Expected Results** | - If price manipulation succeeds → attacker profits<br>- If TWAP/delay protection exists → attack fails |
| **Metrics** | - Attacker profit<br>- Protocol loss |
| **Acceptance Criteria** | Script can fully reproduce the attack loop and output profit/loss statement |

---

### T-07: Price Distortion Under Low Liquidity
**Threat Description**: Small trades in low-liquidity assets can significantly change prices, leading to oracle manipulation.

| Mapping Item | Content |
|--------------|---------|
| **Test Scenario ID** | S-07 |
| **Test Script** | `scenarios/low-liquidity-manipulation.js` |
| **Test Description** | Test price manipulation cost on small market cap tokens |
| **Prerequisites** | - Deploy low-liquidity DEX pool<br>- Deploy lending protocol supporting the token |
| **Test Steps** | 1. Calculate funds needed to manipulate price to target value<br>2. Execute manipulation<br>3. Observe if oracle is affected |
| **Expected Results** | - Lower liquidity → lower manipulation cost → easier to attack |
| **Metrics** | - Manipulation cost (USD)<br>- Price deviation |
| **Acceptance Criteria** | Script can output relationship curve between manipulation cost and price deviation |

---

### T-08: Malicious Oracle Node
**Threat Description**: Oracle nodes submit incorrect prices, causing the aggregator to output abnormal values.

| Mapping Item | Content |
|--------------|---------|
| **Test Scenario ID** | S-08 |
| **Test Script** | `scenarios/malicious-oracle-node.js` |
| **Test Description** | Simulate 1/3 of nodes submitting incorrect prices |
| **Prerequisites** | - Deploy multi-node aggregation oracle (e.g., 5 nodes) |
| **Test Steps** | 1. 2 nodes submit normal prices<br>2. 2 nodes submit abnormally high/low prices<br>3. 1 node does not submit<br>4. Observe aggregation result |
| **Expected Results** | - If using median → resists 1/3 malicious nodes<br>- If using average → easily manipulated |
| **Metrics** | - Aggregated price vs. real price deviation |
| **Acceptance Criteria** | Script can configure number of nodes and proportion of malicious nodes |

---

### T-09: Multi-block Price Manipulation
**Threat Description**: Attackers gradually push up prices over consecutive blocks, bypassing single-block price checks.

| Mapping Item | Content |
|--------------|---------|
| **Test Scenario ID** | S-09 |
| **Test Script** | `scenarios/multi-block-manipulation.js` |
| **Test Description** | Simulate attackers pushing up prices over 5 consecutive blocks |
| **Prerequisites** | - Deploy lending protocol<br>- Deploy time-weighted oracle |
| **Test Steps** | 1. Push price up 10% each block<br>2. After 5 blocks, total increase 61%<br>3. Attempt to exploit incorrect price |
| **Expected Results** | - If only checking single-block change ≤20% → may pass<br>- If checking multi-block weighted average → resists |
| **Metrics** | - Cumulative multi-block price deviation<br>- TWAP vs. spot price |
| **Acceptance Criteria** | Script can control price per block and calculate cumulative deviation |

---

## 🧪 Test Script Common Structure

Each test script should follow this structure:

```javascript
// scenarios/template.js
// Test scenario template

// 1. Environment setup
const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Scenario S-XX: [Scenario Name]", function () {
  before(async function () {
    // Deploy contracts, initialize parameters
  });

  it("Step 1: Prerequisites", async function () {
    // Set up initial state
  });

  it("Step 2: Execute attack/stress injection", async function () {
    // Call setMockPrice, flash loan, etc.
  });

  it("Step 3: Verify results", async function () {
    // Check health factor, liquidation events, price deviation
  });

  it("Step 4: Measure metrics", async function () {
    // Output price error, liquidation rate, protocol loss
  });
});
```

---

## 📊 Acceptance Criteria Summary Table

| Test Scenario ID | Acceptance Criteria |
|------------------|---------------------|
| S-01 | Can output price change curve and liquidation event logs |
| S-02 | Can record timestamp and delay for each price query |
| S-03 | Can read from both sources simultaneously and calculate deviation |
| S-04 | Can output price-time curve and liquidation waterfall chart |
| S-05 | Can simulate node downtime and verify protocol behavior |
| S-06 | Can fully reproduce the attack loop and output profit/loss statement |
| S-07 | Can output relationship curve between manipulation cost and price deviation |
| S-08 | Can configure number of nodes and proportion of malicious nodes |
| S-09 | Can control price per block and calculate cumulative deviation |

---

## 📝 Usage Instructions

1. **Member B (Tester)**: Write test scripts under `scenarios/` according to this mapping table
2. **Member D (Implementer)**: Ensure oracle implementations support interfaces required for testing (e.g., `setMockPrice`)
3. **Member C (Analyst)**: Extract metrics from test script outputs and visualize them
4. **Member A**: Maintain this mapping table, ensure full threat coverage and test executability

---