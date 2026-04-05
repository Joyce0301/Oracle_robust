import json
from typing import Any

import pandas as pd

WEI = 10**18


def _to_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).replace(",", "").strip()
    if not text:
        return None

    try:
        number = float(text)
    except ValueError:
        return None

    if abs(number) >= WEI:
        return number / WEI
    return number


def load_jsonl(log_path: str) -> pd.DataFrame:
    rows = []
    buffer = ""

    with open(log_path, "r", encoding="utf-8-sig") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line:
                continue

            buffer += line
            try:
                rows.append(json.loads(buffer))
                buffer = ""
            except json.JSONDecodeError:
                continue

    if buffer:
        raise ValueError(f"Unparsed JSON payload remains in {log_path}: {buffer[:120]}")

    return pd.DataFrame(rows)


def _scenario_label(raw_name: str) -> str:
    return {
        "flash_crash_liquidation": "flash_crash_liquidation",
        "inflated_oracle_borrow": "inflated_oracle_borrow",
        "mock_oracle_baseline": "mock_oracle_baseline",
        "twap_flash_crash_comparison": "twap_flash_crash_comparison",
        "twap_inflated_price": "twap_inflated_price",
    }.get(raw_name, raw_name)


def _attach_scenarios(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    current_scenario = None
    inferred = []

    for _, row in df.iterrows():
        scenario = row.get("scenario")
        stage = row.get("stage")

        if pd.notna(scenario) and str(scenario).strip():
            current_scenario = scenario
        elif stage == "mock_oracle_baseline":
            current_scenario = "mock_oracle_baseline"

        inferred.append(current_scenario)

    df["scenario"] = inferred
    return df[df["scenario"].notna()].copy()


def compute_all_metrics(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(
            columns=[
                "scenario",
                "realPrice",
                "spotPrice",
                "twapPrice",
                "liquidatorPnl",
                "delaySeconds",
                "badDebt",
                "price_error_spot_pct",
                "price_error_twap_pct",
            ]
        )

    df = _attach_scenarios(df)
    results = []

    for scenario, group in df.groupby("scenario", sort=False):
        row = {
            "scenario": _scenario_label(scenario),
            "realPrice": None,
            "spotPrice": None,
            "twapPrice": None,
            "liquidatorPnl": 0.0,
            "delaySeconds": 0.0,
            "badDebt": 0.0,
        }

        if scenario == "flash_crash_liquidation":
            shock = group[group["stage"] == "oracle_shocked"].tail(1)
            liquidation = group[group["stage"] == "position_liquidated"].tail(1)
            if not shock.empty:
                row["realPrice"] = _to_float(shock.iloc[0].get("collateralPrice"))
                row["spotPrice"] = row["realPrice"]
            if not liquidation.empty:
                row["liquidatorPnl"] = _to_float(liquidation.iloc[0].get("liquidatorPnlUsd")) or 0.0

        elif scenario == "inflated_oracle_borrow":
            opened = group[group["stage"] == "position_opened"].tail(1)
            corrected = group[group["stage"] == "oracle_corrected"].tail(1)
            liquidation = group[group["stage"] == "position_liquidated"].tail(1)
            if opened.empty or corrected.empty:
                continue

            row["spotPrice"] = _to_float(opened.iloc[0].get("inflatedPrice"))
            row["realPrice"] = _to_float(corrected.iloc[0].get("correctedPrice"))
            row["badDebt"] = max(
                (_to_float(corrected.iloc[0].get("debtValueUsd")) or 0.0)
                - (_to_float(corrected.iloc[0].get("collateralValueUsd")) or 0.0),
                0.0,
            )
            if not liquidation.empty:
                row["liquidatorPnl"] = _to_float(liquidation.iloc[0].get("liquidatorPnlUsd")) or 0.0

        elif scenario == "mock_oracle_baseline":
            baseline = group.tail(1)
            if baseline.empty:
                continue
            row["realPrice"] = _to_float(baseline.iloc[0].get("collateralPrice"))
            row["spotPrice"] = row["realPrice"]
            row["delaySeconds"] = _to_float(baseline.iloc[0].get("delaySeconds")) or 0.0

        elif scenario == "twap_flash_crash_comparison":
            started = group[group["stage"] == "scenario_start"].tail(1)
            shock = group[group["stage"] == "oracle_shocked"].tail(1)
            delayed = group[group["stage"] == "twap_liquidation_delayed"].tail(1)
            if not started.empty:
                row["realPrice"] = _to_float(started.iloc[0].get("crashPrice"))
            if not shock.empty:
                row["spotPrice"] = _to_float(shock.iloc[0].get("spotPrice"))
                row["twapPrice"] = _to_float(shock.iloc[0].get("twapPrice"))
            if not delayed.empty:
                row["delaySeconds"] = _to_float(delayed.iloc[0].get("delaySeconds")) or 0.0

        elif scenario == "twap_inflated_price":
            started = group[group["stage"] == "scenario_start"].tail(1)
            inflated = group[group["stage"] == "oracle_inflated"].tail(1)
            summary = group[group["stage"] == "comparison_summary"].tail(1)
            if not started.empty:
                row["realPrice"] = _to_float(started.iloc[0].get("realPrice"))
            if not inflated.empty:
                row["spotPrice"] = _to_float(inflated.iloc[0].get("spotPrice"))
                row["twapPrice"] = _to_float(inflated.iloc[0].get("twapPrice"))
            if not summary.empty:
                row["badDebt"] = _to_float(summary.iloc[0].get("spotExcessDebt")) or 0.0

        else:
            continue

        if row["realPrice"] and row["spotPrice"] is not None:
            row["price_error_spot_pct"] = (
                abs(row["spotPrice"] - row["realPrice"]) / row["realPrice"] * 100
            )
        else:
            row["price_error_spot_pct"] = None

        if row["realPrice"] and row["twapPrice"] is not None:
            row["price_error_twap_pct"] = (
                abs(row["twapPrice"] - row["realPrice"]) / row["realPrice"] * 100
            )
        else:
            row["price_error_twap_pct"] = None

        results.append(row)

    final = pd.DataFrame(results)
    numeric_cols = [
        "realPrice",
        "spotPrice",
        "twapPrice",
        "liquidatorPnl",
        "delaySeconds",
        "badDebt",
        "price_error_spot_pct",
        "price_error_twap_pct",
    ]
    for col in numeric_cols:
        if col in final.columns:
            final[col] = pd.to_numeric(final[col], errors="coerce")
    return final


def build_summary(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame()
    numeric = df.select_dtypes(include=["number"])
    return numeric.describe()
