# DeFi Oracle Robustness - 压力测试场景说明 (by Li Wendi / Member B)

作为 **Security & Stress Testing** 负责人，我已完成了全部压力测试场景的设计、实现与文档编写。本文说明我的工作产出，以及其他组员如何复用这些结果。

## 已完成的工作

### 1. 压力测试场景 (`scenarios/`)

| 场景 | 文件 | 核心发现 |
|------|------|----------|
| 闪崩清算 | `flash_crash_liquidation.cjs` | SpotOracle 下，COL 跌 10%（2000→1800）立刻触发全额清算 |
| 虚高预言机 | `inflated_oracle_borrow.cjs` | 预言机报价虚高 5 倍时，借款人掏空协议 $6000 坏账 |
| MockOracle 基线 | `mock_oracle_baseline.cjs` | 延迟字段已记录但 `getPrice()` 尚未执行，为未来陈旧价场景铺路 |
| TWAP 闪崩对比 | `twap_flash_crash_comparison.cjs` | 同样闪崩：SpotOracle 立刻清算，TWAPOracle 延迟约 900 秒才清算 |
| TWAP 操纵对比 | `twap_inflated_price.cjs` | 同样 5 倍虚高：SpotOracle 允许借 $8000，TWAPOracle 仅允许 $1600 |

### 2. 文档

| 文档 | 路径 | 内容 |
|------|------|------|
| 实验设计 | `docs/experiment-design.md` | 5 个场景的完整叙事、步骤、期望输出、失败标准、未来计划 |
| 威胁模型 | `docs/threat-model.md` | 4 类威胁 (T1-T4)、5 条失败标准 (F1-F5)、场景-威胁映射、TWAP 有效性分析 |
| 场景索引 | `scenarios/README.md` | 文件索引、运行方式、如何添加新场景 |

### 3. 基础设施

- `scenarios/_fixture.cjs`：共享部署工具（代币 + 预言机 + 借贷池 + 100 万流动性）
- 所有场景集成了 Dylan 的 `lib/logger.cjs`，输出结构化 JSON 日志

---

## 给组员 C (Analysis + Writing) 的对接指南

**你需要关注的文件**：所有 `scenarios/*.cjs` 的运行输出

#### 如何获取实验数据

每个场景在运行时都会输出**两种格式**：

1. **人类可读日志**（`console.log`）：直接看懂场景过程
2. **结构化 JSON 日志**（`logEvent`）：可被脚本自动解析

运行所有场景并捕获 JSON 输出：
```bash
npx hardhat run scenarios/run_all.cjs 2>/dev/null | grep '^{' > analysis/raw_results.jsonl
```

每条 JSON 记录包含 `timestamp` 和 `stage` 字段，常见的 stage 包括：

| stage | 含义 | 包含的关键字段 |
|-------|------|---------------|
| `scenario_start` | 场景开始 | `scenario`, `initialPrice`, `crashPrice` |
| `position_opened` | 仓位建立 | `collateralDeposited`, `debtBorrowed` |
| `oracle_shocked` | 价格变动 | `spotPrice`, `twapPrice` |
| `oracle_corrected` | 价格修正 | `correctedPrice`, `debtValueUsd`, `collateralValueUsd` |
| `position_liquidated` | 清算完成 | `debtPaid`, `collateralReceived`, `liquidatorPnlUsd` |
| `spot_liquidation` | Spot 池清算结果 | `result` ("success" / "failed") |
| `twap_liquidation_immediate` | TWAP 池即时清算 | `result`, `twapPrice` |
| `twap_liquidation_delayed` | TWAP 池延迟清算 | `result`, `delaySeconds` |
| `comparison_summary` | 对比汇总 | `spotBorrowed`, `twapMaxBorrow`, `twapReduction` |

#### 建议收集的指标（对应 `docs/experiment-design.md` 第 6 节）

| 指标 | 来源场景 | 计算方式 |
|------|----------|---------|
| LTV 变化量 | 场景 3.1 / 3.4 | `debtBorrowed / (collateralDeposited × oraclePrice)` |
| 清算人 PnL | 场景 3.1 / 3.2 | `liquidatorPnlUsd` 字段直接可用 |
| 协议坏账 | 场景 3.2 / 3.5 | `spotExcessDebt` 字段 |
| TWAP 清算延迟 | 场景 3.4 | `delaySeconds` 字段 |
| TWAP 借款抑制率 | 场景 3.5 | `twapReduction / spotBorrowed × 100%` |

#### 建议制作的图表

1. **SpotOracle vs TWAPOracle 清算时间线**（场景 3.4）：
   - X 轴：价格变动后的秒数，Y 轴：TWAP 报价
   - 标注清算触发点
2. **价格操纵下的借款对比柱状图**（场景 3.5）：
   - Spot 允许借款 vs TWAP 允许借款 vs 真实安全借款额
3. **失败标准触发矩阵**（汇总）：
   - 行：5 个场景，列：F1-F5，单元格打勾表示触发

#### 建议在报告中使用的结论

- **SpotOracle 在价格操纵下完全不设防**：5 倍虚高 → $6400 协议损失（F1+F3+F5 全触发）
- **TWAPOracle 将操纵损害降低至 0**（短期操纵场景），但代价是真实崩盘时清算延迟 ~900 秒
- **全额清算机制对借款人不公平**：10% 的价格下跌导致 100% 的抵押品被没收

---

## 快速运行

```bash
# 运行全部 5 个压力场景
npx hardhat run scenarios/run_all.cjs

# 或单独运行
npm run scenario:flash          # 闪崩清算
npm run scenario:inflated       # 虚高预言机
npm run scenario:mock           # MockOracle 基线
npm run scenario:twap-compare   # TWAP vs Spot 闪崩对比
npm run scenario:twap-inflated  # TWAP vs Spot 操纵对比

# 运行所有单元测试（含 TWAPOracle 测试）
npx hardhat test test/LendingPool.cjs
```

---
*Li Wendi - Security & Stress Testing (Member B)*
