import logging
from typing import Any, Dict, List

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _stack_batch_dataframe(df_raw: pd.DataFrame) -> pd.DataFrame:
    """Apila un DataFrame batch de yfinance en MultiIndex (Date, Ticker)."""
    if isinstance(df_raw.columns, pd.MultiIndex):
        try:
            df_stacked = df_raw.stack(level=0, future_stack=True)
        except TypeError:
            df_stacked = df_raw.stack(level=0)
    else:
        df_stacked = df_raw.copy()
        df_stacked["Ticker"] = "UNKNOWN"
        df_stacked = df_stacked.set_index("Ticker", append=True)

    if df_stacked.index.names[1] is None or df_stacked.index.names[1] != "Ticker":
        df_stacked.index.names = ["Date", "Ticker"]

    df_stacked = df_stacked.sort_index(level="Date")
    return df_stacked


def run_turtle_strategy(df_raw: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Motor vectorizado de Trend Following (Sistema Tortugas S1 - 20 días)
    sobre el DataFrame batch histórico del S&P 500.

    Filtros:
      - Close > SMA_200
      - Avg_Vol_20 > 1_000_000
      - Close >= High_20 (máximo de las 20 ruedas previas, excluyendo hoy)
      - ATR_20 <= 10.00 (control de riesgo nominal)

    Retorna hasta el Top 5 ordenado por ATR_Pct descendente bajo el contrato
    unificado de candidatos.
    """
    if df_raw is None or df_raw.empty:
        logger.warning("[turtle] DataFrame histórico vacío; no se evalúan candidatos.")
        return []

    df_stacked = _stack_batch_dataframe(df_raw)
    required_cols = {"High", "Low", "Close", "Volume"}
    if not required_cols.issubset(set(df_stacked.columns)):
        logger.error("[turtle] Faltan columnas OHLCV requeridas en el DataFrame batch.")
        return []

    grouped = df_stacked.groupby(level="Ticker")

    df_stacked["SMA_200"] = grouped["Close"].transform(lambda x: x.rolling(200).mean())
    df_stacked["High_20"] = grouped["High"].transform(lambda x: x.shift(1).rolling(20).max())
    df_stacked["Low_10"] = grouped["Low"].transform(lambda x: x.shift(1).rolling(10).min())
    df_stacked["Avg_Vol_20"] = grouped["Volume"].transform(lambda x: x.rolling(20).mean())

    prev_close = grouped["Close"].shift(1)
    tr1 = df_stacked["High"] - df_stacked["Low"]
    tr2 = (df_stacked["High"] - prev_close).abs()
    tr3 = (df_stacked["Low"] - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    df_stacked["ATR_20"] = tr.groupby(level="Ticker").transform(lambda x: x.rolling(20).mean())
    df_stacked["ATR_Pct"] = np.where(
        df_stacked["Close"] > 0,
        (df_stacked["ATR_20"] / df_stacked["Close"]) * 100.0,
        np.nan,
    )

    last_day_df = df_stacked.reset_index().groupby("Ticker").last()

    # Descartar activos sin historia suficiente o con NaN en indicadores críticos
    valid_df = last_day_df.dropna(
        subset=["Close", "SMA_200", "High_20", "Low_10", "Avg_Vol_20", "ATR_20", "ATR_Pct"]
    )
    if valid_df.empty:
        logger.info("[turtle] Ningún ticker cuenta con historia válida suficiente (>= 200 ruedas).")
        return []

    filtered_df = valid_df[
        (valid_df["Close"] > valid_df["SMA_200"])
        & (valid_df["Avg_Vol_20"] > 1_000_000)
        & (valid_df["Close"] >= valid_df["High_20"])
        & (valid_df["ATR_20"] <= 10.00)
    ]

    if filtered_df.empty:
        logger.info("[turtle] Sin señales Tortuga hoy. Las Tortugas esperan.")
        return []

    top_df = filtered_df.sort_values(by="ATR_Pct", ascending=False).head(5)

    candidates: List[Dict[str, Any]] = []
    for ticker, row in top_df.iterrows():
        close_val = round(float(row["Close"]), 2)
        n_val = round(float(row["ATR_20"]), 2)
        atr_pct = round(float(row["ATR_Pct"]), 2)
        stop_loss = round(float(row["Close"]) - (2.0 * float(row["ATR_20"])), 2)

        candidates.append(
            {
                "ticker": str(ticker),
                "close_price": close_val,
                "score": atr_pct,
                "target": None,
                "stop_loss": stop_loss,
                "strategy_props": {
                    "n_value": n_val,
                    "atr_20": n_val,
                    "atr_pct": atr_pct,
                    "donchian_high_20": round(float(row["High_20"]), 2),
                    "donchian_low_10": round(float(row["Low_10"]), 2),
                    "sma_200": round(float(row["SMA_200"]), 2),
                    "avg_vol_20": int(round(float(row["Avg_Vol_20"]))),
                    "stop_distance_n": 2.0,
                    "pyramid_triggers": {
                        "unit_2": round(close_val + (0.5 * n_val), 2),
                        "unit_3": round(close_val + (1.0 * n_val), 2),
                        "unit_4": round(close_val + (1.5 * n_val), 2),
                    },
                },
            }
        )

    logger.info(f"[turtle] {len(filtered_df)} señales detectadas; Top {len(candidates)} seleccionado.")
    return candidates
