# DeFi Oracle Robustness - MVP 实现说明 (by Dylan)

作为 **Implementation / Tooling Lead**，我已完成了核心 DeFi 协议原型和预言机模块的开发。本项目旨在研究预言机在极端市场条件下的鲁棒性。

## 核心模块实现

### 1. 借贷协议 (`contracts/protocol/LendingPool.sol`)
实现了一个简化的借贷与清算机制：
- **存入抵押品**：用户可以存入资产作为借贷担保。
- **借入资产**：在抵押充足的情况下借入另一种资产（LTV 设定为 80%）。
- **清算机制**：当抵押品价格下跌导致 LTV 超过 80% 时，清算人可以偿还债务并接管抵押品。

### 2. 预言机方案 (`contracts/oracles/`)
实现了多种预言机以供对比测试：
- **SpotOracle.sol**：模拟即时价格。管理员可以手动更新价格以模拟市场波动。
- **MockOracle.sol**：压力测试专用预言机。支持模拟价格更新延迟，方便组员 B (Security & Stress Testing) 设计对抗性场景。
- **TWAPOracle.sol**：简化版时间加权平均价格预言机，用于提供比 spot 更平滑、更稳的基线。

### 3. 接口规范 (`contracts/interfaces/IPriceOracle.sol`)
定义了统一的 `getPrice(address asset)` 接口，确保协议与预言机解耦，方便未来扩展（如 TWAP 预言机）。

## 快速开始

### 安装依赖
```bash
npm install
```

### 编译合约
```bash
npx hardhat compile
```

### 运行单元测试
```bash
npx hardhat test test/LendingPool.cjs
```

### 部署 MVP 原型
建议先启动本地 Hardhat 节点，再部署，以便压力场景可复现地复用地址文件。
```bash
npx hardhat node
npx hardhat run scripts/deploy_mvp.cjs --network localhost
```

### 运行标准化压力场景
部署完成后，场景脚本会读取 `deployments/mvp.localhost.json`，并以 JSON 日志格式输出执行过程。
```bash
npx hardhat run scenarios/run_price_shock.cjs --network localhost
```

## 给组员的对接说明
- **组员 A (Architecture)**: 接口已按照 `IPriceOracle.sol` 实现，核心逻辑位于 `LendingPool.sol`。
- **组员 B (Security)**: 请使用 `MockOracle.sol` 来模拟你的压力场景。你可以通过 `setPrice` 和未来的 `setDelay` 来触发 `LendingPool.sol` 中的清算逻辑。
- **组员 B (Security)**: 你也可以直接复用 `scenarios/run_price_shock.cjs` 作为模板，统一读取 `deployments/mvp.<network>.json` 并输出结构化日志。
- **组员 C (Analysis)**: 部署脚本会输出所有合约地址，你可以编写分析脚本来监听 `Deposited`, `Borrowed`, `Liquidated` 等事件并计算指标。

---
*Dylan - Implementation Lead*
