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
├── analysis/           # Results analysis and plotting
└── docs/               # Architecture, metrics, and threat model documentation
```

## 🚀 Tech Stack

- **Framework**: Hardhat
- **Language**: Solidity ^0.8.24
- **Testing/Scripts**: Ethers.js, Chai
- **Libraries**: OpenZeppelin

## 🧪 Stress scenarios (Member B)

```bash
npx hardhat run scenarios/flash_crash_liquidation.cjs
npx hardhat run scenarios/inflated_oracle_borrow.cjs
npx hardhat run scenarios/mock_oracle_baseline.cjs
npx hardhat run scenarios/run_all.cjs
```

Or: `npm run scenario:flash`, `scenario:inflated`, `scenario:mock`, `scenario:all`.

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
This script deploys mock tokens, oracles, and the lending pool, and initializes liquidity.
```bash
npx hardhat run scripts/deploy_mvp.cjs
```

## 📝 Developer Notes (Dylan)

- **Interface Decoupling**: All oracles must implement the `IPriceOracle` interface.
- **Stress Testing**: Member B can use `MockOracle.sol` to simulate data anomalies using `setPrice` and `setDelay`.
- **Liquidation Logic**: The liquidation threshold (LTV) is currently set at 80% to observe how oracle price fluctuations affect protocol safety.

---
*This project is for research purposes only and is not intended for production use.*
