# Spec Delta

## MODIFIED Requirements

### Requirement: Screener Candidates Relational Ingestion
The system SHALL persist ranked top candidate stocks into the `screener_candidates` table per enabled strategy, preserving universal columns and strategy-specific metrics in `strategy_props`.

#### Scenario: Unified target calculation and candidate ingestion
- **WHEN** top candidate stocks are selected by the `kotegawa` scoring engine
- **THEN** each candidate target is calculated once using the RRR 1:0.85 rule (`close_price + (close_price - stop_loss) * 0.85`), and records are inserted with universal columns (`created_at`, `ticker`, `strategy = 'kotegawa'`, `close_price`, `score`, `target`, `stop_loss`) and Kotegawa metrics (`rsi`, `z_score`, `atr_14`) in `strategy_props`.

#### Scenario: Candidate ingestion for Turtle without fixed target
- **WHEN** top candidate stocks are selected by the `turtle` engine
- **THEN** records are inserted into `screener_candidates` with `strategy = 'turtle'`, `target = null`, `stop_loss` set to `2N` below `close_price`, `score` set to `ATR_Pct`, and Turtle technical metrics inside `strategy_props` without creating duplicate `(created_at, ticker, strategy)` entries.

### Requirement: Simulated Trade Lifecycle Management
The system SHALL autonomously manage the opening, monitoring, pyramiding, and closing of backtest mock trades (`taken = false`) in the `trades` table according to each trade's `strategy`.

#### Scenario: Evaluating open mock trades against daily High/Low
- **WHEN** the daily pipeline evaluates an open mock trade (`status = 'OPEN'`, `taken = false`, `strategy = 'kotegawa'`)
- **THEN** it checks daily market price extremes and updates touched positions to `status = 'CLOSED'` with `exit_date`, `exit_price`, `exit_reason` (`TP` or `SL`), `pnl_percent`, and `days_held`.

#### Scenario: Evaluating open Turtle mock trades for 2N Stop or 10-day Donchian Trailing Stop
- **WHEN** the daily pipeline evaluates an open Turtle mock trade (`status = 'OPEN'`, `taken = false`, `strategy = 'turtle'`)
- **THEN** it fetches recent daily history (`1mo`) to compute the prior 10-day Donchian Low (`donchian_low_10`), and if the session `Low <= max(stop_2n, donchian_low_10)`, it closes the full position (`status = 'CLOSED'`) with `exit_reason = 'TRAILING_STOP'` (if triggered by `donchian_low_10`) or `'SL'` (if triggered by `stop_2n`), computing `pnl_percent` against the current weighted `entry_price`.

#### Scenario: Pyramiding open Turtle mock trades up to 4 units
- **WHEN** an open Turtle mock trade survives the daily stop check and the session `High >= next_pyramid_price` while `units < 4`
- **THEN** the pipeline simulates adding unit(s) at `next_pyramid_price` intervals of `+0.5N` (up to `max_units = 4`), updates the same `trades` row with the new weighted average `entry_price`, raises `stop_2n` to `2N` below the latest unit fill, updates `stop_loss = max(stop_2n, donchian_low_10)`, and persists `units`, `unit_fills`, `trailing_stop_10d`, and `next_pyramid_price` in `strategy_props`.

#### Scenario: Opening new mock trades with unified target
- **WHEN** the day's candidate scan is complete for a strategy and slots are available
- **THEN** the system copies the candidate's exact `target` (including `null` for `turtle`) and `stop_loss` without recalculation, initializes `strategy_props` (including Turtle unit/pyramid state when `strategy = 'turtle'`), and inserts records in `trades` with `status = 'OPEN'` and `taken = false`.

## ADDED Requirements

### Requirement: Multi-Strategy Pipeline Execution Loop
The system SHALL execute all enabled quantitative strategies sequentially over a single shared S&P 500 historical batch download (`period = "250d"`) per daily pipeline run.

#### Scenario: Iterating enabled strategies in daily pipeline
- **WHEN** the daily backend pipeline runs
- **THEN** it executes `evaluate_open_trades` first, downloads S&P 500 `250d` history once, runs both `kotegawa` and `turtle` engines, persists candidates and mock trades per strategy, and updates `market_metadata`.

### Requirement: Portfolio Heat Concurrency Limit
The system SHALL enforce a strict maximum of `5` concurrent open theoretical trades (`status = 'OPEN'`, `taken = false`) per strategy when opening new mock positions.

#### Scenario: Capping new mock trades to available portfolio slots
- **WHEN** a strategy already has `4` open mock trades and the screener produces `5` new candidates
- **THEN** the pipeline excludes tickers already `OPEN` for that strategy and inserts only the top `1` eligible candidate by descending `score` so total open mock trades do not exceed `5`.

#### Scenario: Blocking new mock trades when Portfolio Heat is full
- **WHEN** a strategy already has `5` open mock trades (`status = 'OPEN'`, `taken = false`)
- **THEN** the pipeline opens `0` new mock trades for that strategy while still persisting the day's candidates in `screener_candidates`.
