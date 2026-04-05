from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt
from metrics import load_jsonl, compute_all_metrics, build_summary

def main():
    analysis_dir = Path(__file__).resolve().parent
    raw_results_path = analysis_dir / "raw_results.jsonl"
    results_dir = analysis_dir.parent / "docs" / "results"

    print("🔄 Loading log...")
    df_raw = load_jsonl(str(raw_results_path))
    df = compute_all_metrics(df_raw)

    results_dir.mkdir(parents=True, exist_ok=True)
    df.to_csv(results_dir / "full_analysis.csv", index=False)

    summary = build_summary(df)
    summary.to_csv(results_dir / "summary_metrics.csv")

    print("\n📊 Final Results:\n")
    print(df.round(2))
    print("\n🎨 Generating 4 charts...")

    # ----------------------
    # 1. 价格误差对比
    # ----------------------
    plt.figure(figsize=(12,5))
    df.plot(x="scenario", y=["price_error_spot_pct","price_error_twap_pct"], kind="bar", color=["#1f77b4","#ff7f0e"], ax=plt.gca())
    plt.title("Price Error: Spot vs TWAP")
    plt.ylabel("Error %")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(results_dir / "price_error.png")
    print("✅ price_error.png")

    # ----------------------
    # 2. 清算 PnL
    # ----------------------
    plt.figure(figsize=(12,5))
    pnl = df[df["liquidatorPnl"]!=0]
    if not pnl.empty:
        colors = ["#2ca02c" if x>0 else "#d62728" for x in pnl["liquidatorPnl"]]
        pnl.plot(x="scenario", y="liquidatorPnl", kind="bar", color=colors, ax=plt.gca())
        plt.axhline(0, c="black", ls="--", alpha=0.5)
        plt.title("Liquidator PnL")
        plt.ylabel("USD")
        plt.grid(alpha=0.3)
        plt.tight_layout()
        plt.savefig(results_dir / "liquidation_pnl.png")
        print("✅ liquidation_pnl.png")

    # ----------------------
    # 3. TWAP 延迟
    # ----------------------
    plt.figure(figsize=(12,5))
    delay = df[df["delaySeconds"]>0]
    if not delay.empty:
        delay.plot(x="scenario", y="delaySeconds", kind="bar", color="#1f77b4", ax=plt.gca())
        plt.title("TWAP Delay")
        plt.ylabel("Seconds")
        plt.grid(alpha=0.3)
        plt.tight_layout()
        plt.savefig(results_dir / "twap_delay.png")
        print("✅ twap_delay.png")

    # ----------------------
    # 4. 坏账
    # ----------------------
    plt.figure(figsize=(12,5))
    debt = df[df["badDebt"]>0]
    if not debt.empty:
        debt.plot(x="scenario", y="badDebt", kind="bar", color="#ff7f0e", ax=plt.gca())
        plt.title("Bad Debt")
        plt.ylabel("USD")
        plt.grid(alpha=0.3)
        plt.tight_layout()
        plt.savefig(results_dir / "bad_debt.png")
        print("✅ bad_debt.png")

    print("\n🎉 ALL DONE — 4 charts completed!")

if __name__ == "__main__":
    main()
