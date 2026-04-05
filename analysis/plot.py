import matplotlib.pyplot as plt
import seaborn as snn
import pandas as pd

plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

def plot_price_error(df: pd.DataFrame, out_path="../docs/results/price_error.png"):
    if 'price_error_spot_pct' not in df.columns or 'price_error_twap_pct' not in df.columns:
        print("⚠️ 无价格误差数据")
        return
    plt.figure(figsize=(12,5))
    snn.lineplot(data=df, y='price_error_spot_pct', label='SpotOracle', linewidth=2)
    snn.lineplot(data=df, y='price_error_twap_pct', label='TWAPOracle', linewidth=2)
    plt.title('Price Error %: Spot vs TWAP')
    plt.ylabel('Error %')
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_path, dpi=300)
    plt.close()

def plot_protocol_loss(df: pd.DataFrame, out_path="../docs/results/protocol_loss.png"):
    if 'protocol_loss_usd' not in df.columns:
        print("⚠️ 无损失数据")
        return
    plt.figure(figsize=(12,5))
    snn.histplot(df['protocol_loss_usd'], bins=15, kde=True, color='red')
    plt.title('Protocol Loss Distribution')
    plt.xlabel('Loss (USD)')
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_path, dpi=300)
    plt.close()

def plot_twap_delay(df: pd.DataFrame, out_path="../docs/results/twap_delay.png"):
    if 'twap_delay_seconds' not in df.columns:
        print("⚠️ 无延迟数据")
        return
    plt.figure(figsize=(12,5))
    snn.histplot(df['twap_delay_seconds'], bins=15, kde=True, color='orange')
    plt.title('TWAP Liquidation Delay (seconds)')
    plt.xlabel('Seconds')
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_path, dpi=300)
    plt.close()

def plot_bad_debt(df: pd.DataFrame, out_path="../docs/results/bad_debt.png"):
    if 'bad_debt_usd' not in df.columns:
        print("⚠️ 无坏账数据")
        return
    plt.figure(figsize=(12,5))
    snn.barplot(x=['SpotOracle'], y=[df['bad_debt_usd'].sum()], color='crimson')
    plt.title('Total Bad Debt Under Manipulation')
    plt.ylabel('Bad Debt (USD)')
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_path, dpi=300)
    plt.close()