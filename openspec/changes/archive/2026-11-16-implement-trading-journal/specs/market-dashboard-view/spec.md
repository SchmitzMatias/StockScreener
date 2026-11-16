# Spec Delta

## Purpose

Extiende la visualización del dashboard para permitir inspeccionar posiciones teóricas abiertas vs. cerradas mediante sub-tabs y contrastar las métricas del portafolio real frente al backtest.

## ADDED Requirements

### Requirement: Theoretical Trades Status Sub-Tabs
The frontend SHALL provide sub-tabs in the `Theoretical Trades` panel (Column 2) to toggle between closed backtest trades and currently open simulated positions.

#### Scenario: Switching between Closed and Open theoretical trades
- **WHEN** the user selects the `Abiertos (En Curso)` sub-tab in the `Theoretical Trades` panel
- **THEN** the table displays records from `trades` where `taken = false` and `status = 'OPEN'` using open position columns (`ticker`, `entry_date`, `entry_price`, `target`, `stop_loss`), and switches back to closed trades (`status = 'CLOSED'`) when `Cerrados (Historial)` is selected.

### Requirement: Real Portfolio Summary KPIs Footer
The frontend SHALL compute and render summary performance metrics (`Win Rate`, `Cumulative PnL`, `Closed Trades`, `Avg Days Held`) in the footer of the `Real Portfolio` history panel (`taken = true` and `status = 'CLOSED'`).

#### Scenario: Rendering real portfolio performance metrics
- **WHEN** the `Trade History` panel in Column 3 renders closed real trades
- **THEN** a summary footer displays the calculated Win Rate (percentage of closed real trades with `pnl_percent > 0`), Cumulative PnL %, total closed trades count, and average days held.
