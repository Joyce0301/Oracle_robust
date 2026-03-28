# DeFi Oracle Robustness Under Stress

This project investigates the robustness of Decentralized Finance (DeFi) oracles under stress conditions such as price manipulation, liquidity drops, and high volatility. We have built a minimum viable DeFi prototype (simplified lending and liquidation mechanism) and integrated various oracle designs to empirically evaluate their performance.

## 👥 Team & Roles

- **Dylan (Implementation / Tooling Lead)**: Owner of contracts, oracles, and the MVP prototype. Responsible for implementation, deployment scripts, and tooling.
- **Member A (Architecture / Spec Owner)**: Responsible for threat modeling, oracle interface specifications, and system assumptions/invariants.
- **Member B (Security & Stress Testing)**: Responsible for designing attack/stress scenarios and writing `scenarios/` scripts.
- **Member C (Analysis + Writing)**: Responsible for defining metrics, running experiments, and documenting results/discussions.

## 🏗️ Project Structure

```text
├── contracts/          # Smart contracts (Solidity)
│   ├── interfaces/     # Standard interface specifications
│   ├── protocol/       # DeFi protocol prototype (LendingPool)
│   └── oracles/        # Oracle implementations (Spot, Mock, etc.)
├── scripts/            # Deployment and initialization scripts
├── test/               # Unit tests (Hardhat/Mocha)
├── scenarios/          # Adversarial and stress testing scripts
├── deployments/        # Machine-readable deployment outputs for scripts
├── analysis/           # Results analysis and plotting
└── docs/               # Architecture, metrics, and threat model documentation
```

## 🚀 Tech Stack

- **Framework**: Hardhat
- **Language**: Solidity ^0.8.24
- **Testing/Scripts**: Ethers.js, Chai
- **Libraries**: OpenZeppelin

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Compile Contracts
```bash
npx hardhat compile
```

### 3. Run Unit Tests
```bash
npx hardhat test test/LendingPool.cjs
```

### 4. Deploy MVP Environment
For reusable scenario runs, start a local Hardhat node first, then deploy to `localhost`.
```bash
npx hardhat node
npx hardhat run scripts/deploy_mvp.cjs --network localhost
```

### 5. Run a Standardized Stress Scenario
After deployment, scenario scripts load `deployments/mvp.localhost.json` and emit JSON logs for analysis.
```bash
npx hardhat run scenarios/run_price_shock.cjs --network localhost
```

## 📝 Developer Notes (Dylan)

- **Interface Decoupling**: All oracles must implement the `IPriceOracle` interface.
- **Stress Testing**: Member B can use `MockOracle.sol` to simulate data anomalies using `setPrice` and `setDelay`.
- **Stable Oracle Baseline**: `TWAPOracle.sol` provides a smoother baseline than spot pricing, making oracle comparisons more meaningful.
- **Scenario Integration**: Deployment addresses are written to `deployments/mvp.<network>.json`, and scenario scripts emit JSON logs so experiments are reproducible.
- **Liquidation Logic**: The liquidation threshold (LTV) is currently set at 80% to observe how oracle price fluctuations affect protocol safety.

---
*This project is for research purposes only and is not intended for production use.*
