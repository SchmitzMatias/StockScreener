# Spec Delta

## Purpose

Provee un motor cuantitativo vectorizado para la estrategia *Trend Following* de las Tortugas (Sistema S1 de 20 días) sobre el universo del S&P 500, generando candidatos rankeados con niveles de ruptura Donchian, riesgo `N` (ATR 20), Stop Loss `2N` y gatillos de piramidación en `strategy_props`.

## ADDED Requirements

### Requirement: Vectorized Turtle Technical Indicators and Entry Screening
The system SHALL evaluate the S&P 500 historical price batch (`250d`) in a vectorized manner to detect Turtle System 1 breakout candidates satisfying trend, liquidity, nominal risk, and 20-day Donchian breakout conditions.

#### Scenario: Filtering valid Turtle breakout candidates
- **WHEN** the Turtle engine processes the batch historical OHLCV dataset
- **THEN** it computes `SMA_200`, `High_20` (prior 20-day maximum High excluding current day), `Low_10` (prior 10-day minimum Low excluding current day), `Avg_Vol_20`, `ATR_20` (`N`), and `ATR_Pct = (ATR_20 / Close) * 100`, selecting only tickers where `Close > SMA_200`, `Avg_Vol_20 > 1_000_000`, `Close >= High_20`, and `ATR_20 <= 10.00`.

#### Scenario: Skipping tickers with insufficient history or NaN indicators
- **WHEN** a ticker has fewer than 200 valid sessions or yields `NaN` in `SMA_200`, `High_20`, `Low_10`, or `ATR_20`
- **THEN** the engine excludes that ticker without raising an unhandled exception.

### Requirement: Turtle Candidate Ranking and Strategy Props Payload
The system SHALL rank qualifying Turtle candidates by `ATR_Pct` descending (Top 5) and format each candidate with `strategy = 'turtle'`, `target = null`, `stop_loss = Close - 2 * N`, and Turtle-specific metrics inside `strategy_props`.

#### Scenario: Formatting Top 5 Turtle candidates for persistence
- **WHEN** one or more tickers pass the Turtle entry filters
- **THEN** the engine selects up to the top 5 sorted by `ATR_Pct` descending, assigns `score = ATR_Pct`, `target = null`, `stop_loss = Close - 2 * ATR_20`, and populates `strategy_props` with `n_value`, `atr_20`, `atr_pct`, `donchian_high_20`, `donchian_low_10`, `sma_200`, `avg_vol_20`, `stop_distance_n`, and `pyramid_triggers` (`unit_2`, `unit_3`, `unit_4` at `+0.5N`, `+1.0N`, `+1.5N`).
