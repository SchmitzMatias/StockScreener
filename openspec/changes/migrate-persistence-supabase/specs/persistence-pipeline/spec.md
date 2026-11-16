# Spec Delta

## Purpose

Provides automated relational persistence for market conditions, technical screener candidates, and backtest simulated trade lifecycles into Supabase PostgreSQL.

## ADDED Requirements

### Requirement: Automated Market Metadata Persistence
The system SHALL persist aggregated macroeconomic market conditions into the `market_metadata` table upon every pipeline run.

#### Scenario: Successful metadata upsert
- **WHEN** the quantitative pipeline completes metric calculations for SPY, VIX, and S&P 500 breadth (% above SMA20)
- **THEN** it executes an idempotent upsert on record `id = 1` in `market_metadata` including `last_run`, `spy_price`, `spy_change`, `spy_history`, `vix_price`, `vix_change`, and `sma20_bull_pct`.

### Requirement: Screener Candidates Relational Ingestion
The system SHALL persist ranked top candidate stocks into the `screener_candidates` table using unified risk-reward targets.

#### Scenario: Unified target calculation and candidate ingestion
- **WHEN** top candidate stocks are selected by the scoring engine
- **THEN** each candidate target is calculated once using the RRR 1:0.85 rule (`close_price + (close_price - stop_loss) * 0.85`), and records are inserted with universal columns (`created_at`, `ticker`, `strategy`, `close_price`, `score`, `target`, `stop_loss`) and strategy-specific metrics in `strategy_props`.

### Requirement: Simulated Trade Lifecycle Management
The system SHALL autonomously manage the opening, monitoring, and closing of backtest mock trades (`taken = false`) in the `trades` table.

#### Scenario: Evaluating open mock trades against daily High/Low
- **WHEN** the daily pipeline begins and finds records in `trades` with `status = 'OPEN'` and `taken = false`
- **THEN** it checks daily market price extremes and updates touched positions to `status = 'CLOSED'` with `exit_date`, `exit_price`, `exit_reason` (`TP` or `SL`), `pnl_percent`, and `days_held`.

#### Scenario: Opening new mock trades with unified target
- **WHEN** the day's candidate scan is complete and new theoretical positions are appended
- **THEN** the system copies the candidate's exact `target` and `stop_loss` without recalculation and creates records in `trades` with `status = 'OPEN'` and `taken = false`.

### Requirement: Data Sanitization and Type Safety
The system SHALL sanitize numerical datasets prior to database insertion, eliminating incompatible values.

#### Scenario: Handling non-compliant float and null values
- **WHEN** calculations yield `NaN`, `Infinity`, or NumPy types (`float64`, `bool_`)
- **THEN** the pipeline converts `NaN` and `Inf` to PostgreSQL `null` equivalents and casts NumPy scalars to native Python primitives before executing Supabase queries.

