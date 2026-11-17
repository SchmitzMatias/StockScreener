# Spec Delta

## Purpose

Enables read-only asynchronous data hydration from Supabase into the React dashboard for market indicators, screener candidates, and trading logs.

## ADDED Requirements

### Requirement: Asynchronous Market Header Hydration
The frontend SHALL query market metadata from Supabase and render macro status cards reactively.

#### Scenario: Hydrating Header with live Supabase metadata
- **WHEN** the dashboard application loads in the browser
- **THEN** it asynchronously fetches the latest record from `market_metadata` and safely renders SPY SparkLine, VIX volatility regime, Bullish participation bar, and Cronjob timestamp without blocking first paint.

### Requirement: Read-Only Screener and Trade Tables Hydration
The frontend SHALL asynchronously fetch screener candidates and categorized trade history records.

#### Scenario: Displaying latest screener candidates
- **WHEN** the user views the Screener Engine column
- **THEN** the system fetches candidate records from `screener_candidates` filtered by the latest `created_at` timestamp and renders them in order of descending `score`.

#### Scenario: Displaying theoretical backtest performance
- **WHEN** the user views the Theoretical Performance column
- **THEN** the system fetches records from `trades` where `taken = false`, renders closed and open mock positions, and computes aggregate metrics (Win Rate, Cumulative PnL, Avg Days Held).

#### Scenario: Displaying real portfolio positions and history
- **WHEN** the user views the Real Portfolio column
- **THEN** the system queries `trades` where `taken = true`, segregating records by `status = 'OPEN'` (Live Positions) and `status = 'CLOSED'` (Trade History) in read-only mode.

### Requirement: Graceful Loading and Error States
The frontend SHALL handle asynchronous lifecycle states gracefully without unhandled runtime exceptions.

#### Scenario: Initial loading state
- **WHEN** data queries are in flight
- **THEN** table panels and metric cards display appropriate loading indicators or fallback states, preventing null reference errors on array operations.

