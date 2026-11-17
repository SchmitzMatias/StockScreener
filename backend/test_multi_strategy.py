import os
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))

import data_loader
from turtle_engine import run_turtle_strategy


def _make_batch_df(ticker_specs):
    """Construye un DataFrame MultiIndex (Ticker, Field) compatible con yf.download(group_by='ticker')."""
    dates = pd.date_range("2025-01-01", periods=220, freq="B")
    frames = {}
    for ticker, spec in ticker_specs.items():
        n_rows = spec.get("rows", 220)
        base = spec.get("base", 100.0)
        tr_range = spec.get("tr", 2.0)
        vol = spec.get("vol", 2_000_000)
        last_close = spec.get("last_close", base + 10.0)

        closes = np.full(n_rows, base, dtype=float)
        highs = closes + (tr_range / 2.0)
        lows = closes - (tr_range / 2.0)
        vols = np.full(n_rows, vol, dtype=float)

        closes[-1] = last_close
        highs[-1] = last_close + (tr_range / 2.0)
        lows[-1] = last_close - (tr_range / 2.0)

        df_t = pd.DataFrame(
            {
                "Open": closes,
                "High": highs,
                "Low": lows,
                "Close": closes,
                "Volume": vols,
            },
            index=dates[-n_rows:],
        )
        frames[ticker] = df_t

    return pd.concat(frames, axis=1, sort=True)


class FakeSupabaseQuery:
    def __init__(self, table_name, storage):
        self.table_name = table_name
        self.storage = storage
        self._filters = []
        self._op = "select"
        self._payload = None

    def select(self, *_args):
        self._op = "select"
        return self

    def insert(self, payload):
        self._op = "insert"
        self._payload = payload
        return self

    def update(self, payload):
        self._op = "update"
        self._payload = payload
        return self

    def eq(self, col, val):
        self._filters.append((col, val))
        return self

    def _matches(self, row):
        return all(row.get(col) == val for col, val in self._filters)

    def execute(self):
        rows = self.storage.setdefault(self.table_name, [])
        if self._op == "select":
            return SimpleNamespace(data=[dict(r) for r in rows if self._matches(r)])
        if self._op == "insert":
            new_row = dict(self._payload)
            new_row.setdefault("id", len(rows) + 1)
            rows.append(new_row)
            return SimpleNamespace(data=[new_row])
        if self._op == "update":
            updated = []
            for r in rows:
                if self._matches(r):
                    r.update(self._payload)
                    updated.append(dict(r))
            return SimpleNamespace(data=updated)
        return SimpleNamespace(data=[])


class FakeSupabaseClient:
    def __init__(self, initial_data=None):
        self.storage = {
            "trades": list((initial_data or {}).get("trades", [])),
            "screener_candidates": list((initial_data or {}).get("screener_candidates", [])),
        }

    def table(self, name):
        return FakeSupabaseQuery(name, self.storage)


class TestTurtleEngine(unittest.TestCase):
    def test_filtering_and_ranking_top5_and_schema(self):
        specs = {
            "SHORT": {"rows": 150, "base": 100.0, "tr": 2.0, "vol": 2_000_000, "last_close": 120.0},
            "LOWVOL": {"rows": 220, "base": 100.0, "tr": 2.0, "vol": 500_000, "last_close": 120.0},
            "HIGHATR": {"rows": 220, "base": 100.0, "tr": 12.0, "vol": 2_000_000, "last_close": 120.0},
            "NOBREAK": {"rows": 220, "base": 100.0, "tr": 2.0, "vol": 2_000_000, "last_close": 99.0},
            "T1": {"rows": 220, "base": 100.0, "tr": 2.0, "vol": 2_000_000, "last_close": 110.0},
            "T2": {"rows": 220, "base": 100.0, "tr": 4.0, "vol": 2_000_000, "last_close": 110.0},
            "T3": {"rows": 220, "base": 100.0, "tr": 6.0, "vol": 2_000_000, "last_close": 110.0},
            "T4": {"rows": 220, "base": 100.0, "tr": 8.0, "vol": 2_000_000, "last_close": 110.0},
            "T5": {"rows": 220, "base": 100.0, "tr": 9.0, "vol": 2_000_000, "last_close": 110.0},
            "T6": {"rows": 220, "base": 100.0, "tr": 1.0, "vol": 2_000_000, "last_close": 110.0},
        }
        df_raw = _make_batch_df(specs)
        results = run_turtle_strategy(df_raw)

        self.assertEqual(len(results), 5)
        self.assertEqual([r["ticker"] for r in results], ["T5", "T4", "T3", "T2", "T1"])

        top = results[0]
        self.assertIsNone(top["target"])
        self.assertEqual(top["close_price"], 110.0)
        self.assertLess(top["stop_loss"], top["close_price"])

        props = top["strategy_props"]
        for key in [
            "n_value",
            "atr_20",
            "atr_pct",
            "donchian_high_20",
            "donchian_low_10",
            "sma_200",
            "avg_vol_20",
            "stop_distance_n",
            "pyramid_triggers",
        ]:
            self.assertIn(key, props)

        self.assertEqual(set(props["pyramid_triggers"].keys()), {"unit_2", "unit_3", "unit_4"})


class TestDataLoaderMultiStrategy(unittest.TestCase):
    def _make_history_df(self, low_prev_10, low_today, high_today):
        dates = pd.date_range("2025-10-01", periods=15, freq="B")
        lows = np.full(15, low_prev_10, dtype=float)
        highs = np.full(15, low_prev_10 + 5.0, dtype=float)
        lows[-1] = low_today
        highs[-1] = high_today
        return pd.DataFrame({"High": highs, "Low": lows, "Close": highs - 1.0}, index=dates)

    def test_evaluate_open_trades_turtle_trailing_stop_sl_and_pyramiding(self):
        client = FakeSupabaseClient({
            "trades": [
                # 1. Cierre por TRAILING_STOP (Donchian 10d = 105 > stop_2n = 96, low_today = 104)
                {
                    "id": 1,
                    "ticker": "NVDA",
                    "strategy": "turtle",
                    "taken": False,
                    "status": "OPEN",
                    "entry_date": "2025-10-01",
                    "entry_price": 100.0,
                    "target": None,
                    "stop_loss": 96.0,
                    "strategy_props": {
                        "n_at_entry": 2.0,
                        "units": 1,
                        "max_units": 4,
                        "unit_fills": [100.0],
                        "stop_2n": 96.0,
                        "trailing_stop_10d": 105.0,
                        "next_pyramid_price": 101.0,
                    },
                },
                # 2. Cierre por SL 2N (stop_2n = 96 > donchian_10d = 90, low_today = 95)
                {
                    "id": 2,
                    "ticker": "AMD",
                    "strategy": "turtle",
                    "taken": False,
                    "status": "OPEN",
                    "entry_date": "2025-10-01",
                    "entry_price": 100.0,
                    "target": None,
                    "stop_loss": 96.0,
                    "strategy_props": {
                        "n_at_entry": 2.0,
                        "units": 1,
                        "max_units": 4,
                        "unit_fills": [100.0],
                        "stop_2n": 96.0,
                        "trailing_stop_10d": 90.0,
                        "next_pyramid_price": 101.0,
                    },
                },
                # 3. Piramidación en misma fila (entry=100, N=2 -> pyr=101, high_today=101.5)
                {
                    "id": 3,
                    "ticker": "MSFT",
                    "strategy": "turtle",
                    "taken": False,
                    "status": "OPEN",
                    "entry_date": "2025-10-01",
                    "entry_price": 100.0,
                    "target": None,
                    "stop_loss": 96.0,
                    "strategy_props": {
                        "n_at_entry": 2.0,
                        "units": 1,
                        "max_units": 4,
                        "unit_fills": [100.0],
                        "stop_2n": 96.0,
                        "trailing_stop_10d": 95.0,
                        "next_pyramid_price": 101.0,
                    },
                },
            ]
        })

        histories = {
            "NVDA": self._make_history_df(low_prev_10=105.0, low_today=104.0, high_today=108.0),
            "AMD": self._make_history_df(low_prev_10=90.0, low_today=95.0, high_today=99.0),
            "MSFT": self._make_history_df(low_prev_10=95.0, low_today=99.5, high_today=101.5),
        }

        def fake_ticker(sym):
            m = MagicMock()
            m.history.return_value = histories[sym]
            return m

        with patch.object(data_loader.yf, "Ticker", side_effect=fake_ticker):
            closed = data_loader.evaluate_open_trades(client)

        self.assertEqual(len(closed), 2)
        nvda = client.storage["trades"][0]
        self.assertEqual(nvda["status"], "CLOSED")
        self.assertEqual(nvda["exit_reason"], "TRAILING_STOP")
        self.assertEqual(nvda["exit_price"], 105.0)

        amd = client.storage["trades"][1]
        self.assertEqual(amd["status"], "CLOSED")
        self.assertEqual(amd["exit_reason"], "SL")
        self.assertEqual(amd["exit_price"], 96.0)

        msft = client.storage["trades"][2]
        self.assertEqual(msft["status"], "OPEN")
        self.assertEqual(msft["entry_price"], 100.5)  # promedio de 100.0 y 101.0
        self.assertEqual(msft["stop_loss"], 97.0)     # max(101 - 2*2, 95) = 97.0
        self.assertEqual(msft["strategy_props"]["units"], 2)
        self.assertEqual(msft["strategy_props"]["unit_fills"], [100.0, 101.0])
        self.assertEqual(msft["strategy_props"]["next_pyramid_price"], 102.0)

    def test_append_new_trades_portfolio_heat_limit_5(self):
        open_4 = [
            {"id": i + 1, "ticker": f"OPEN{i}", "strategy": "turtle", "status": "OPEN", "taken": False, "entry_date": "2025-10-01"}
            for i in range(4)
        ]
        client = FakeSupabaseClient({"trades": open_4})

        candidates = [
            {"ticker": "C1", "close_price": 50.0, "score": 3.0, "target": None, "stop_loss": 46.0, "strategy_props": {"n_value": 2.0, "donchian_low_10": 47.0, "donchian_high_20": 49.5}},
            {"ticker": "C2", "close_price": 60.0, "score": 5.5, "target": None, "stop_loss": 54.0, "strategy_props": {"n_value": 3.0, "donchian_low_10": 55.0, "donchian_high_20": 59.0}},
            {"ticker": "C3", "close_price": 70.0, "score": 4.0, "target": None, "stop_loss": 64.0, "strategy_props": {"n_value": 3.0, "donchian_low_10": 65.0, "donchian_high_20": 69.0}},
            {"ticker": "C4", "close_price": 80.0, "score": 2.0, "target": None, "stop_loss": 74.0, "strategy_props": {"n_value": 3.0, "donchian_low_10": 75.0, "donchian_high_20": 79.0}},
            {"ticker": "C5", "close_price": 90.0, "score": 1.0, "target": None, "stop_loss": 84.0, "strategy_props": {"n_value": 3.0, "donchian_low_10": 85.0, "donchian_high_20": 89.0}},
        ]

        inserted = data_loader.append_new_trades(candidates, "2026-11-17", strategy="turtle", supabase_client=client)
        self.assertEqual(len(inserted), 1)
        self.assertEqual(inserted[0]["ticker"], "C2")
        self.assertIsNone(inserted[0]["target"])
        self.assertEqual(inserted[0]["strategy_props"]["units"], 1)

        # Con 5 abiertas, no debe abrir ninguna más
        inserted_full = data_loader.append_new_trades(candidates, "2026-11-17", strategy="turtle", supabase_client=client)
        self.assertEqual(len(inserted_full), 0)

    def test_persist_screener_candidates_and_normalize_kotegawa(self):
        client = FakeSupabaseClient()
        kote_raw = [{
            "Ticker": "AAPL",
            "Price": 200.0,
            "Bounce_Score": 88.5,
            "Target_FrontRun": 204.25,
            "Stop_Loss_Sugerido": 195.0,
            "RSI": 29.5,
            "Z-Score": -2.4,
            "ATR_14": 3.33,
        }]
        norm_kote = data_loader.normalize_kotegawa_candidates(kote_raw)
        saved_kote = data_loader.persist_screener_candidates(norm_kote, "2026-11-17", strategy="kotegawa", supabase_client=client)
        self.assertEqual(len(saved_kote), 1)
        self.assertEqual(saved_kote[0]["strategy"], "kotegawa")
        self.assertEqual(saved_kote[0]["target"], 204.25)

        turtle_cands = [{
            "ticker": "NVDA",
            "close_price": 140.0,
            "score": 4.25,
            "target": None,
            "stop_loss": 128.1,
            "strategy_props": {"n_value": 5.95, "atr_pct": 4.25},
        }]
        saved_turtle = data_loader.persist_screener_candidates(turtle_cands, "2026-11-17", strategy="turtle", supabase_client=client)
        self.assertEqual(len(saved_turtle), 1)
        self.assertEqual(saved_turtle[0]["strategy"], "turtle")
        self.assertIsNone(saved_turtle[0]["target"])


if __name__ == "__main__":
    unittest.main()
