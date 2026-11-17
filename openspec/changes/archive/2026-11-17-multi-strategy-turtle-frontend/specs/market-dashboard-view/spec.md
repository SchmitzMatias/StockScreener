# Spec Delta: market-dashboard-view

## ADDED Requirements

### Requirement: Global Strategy Selector and Dynamic Column Rendering
The frontend SHALL maintain a top-level `activeStrategy` state (`'kotegawa' | 'turtle'`, defaulting to `'kotegawa'`) controllable from the Header, and dynamically adapt table columns to render `strategy_props` JSONB fields when `'turtle'` is selected.

#### Scenario: Switching active strategy from the Header selector
- **WHEN** the user selects `'turtle'` or `'kotegawa'` in the Header strategy selector
- **THEN** the dashboard clears any transient candidate or modal selection, re-fetches `screener_candidates` and `trades` filtered by `strategy = activeStrategy`, and updates table columns accordingly.

#### Scenario: Rendering Today's Top 5 columns for Turtle strategy
- **WHEN** `activeStrategy` is `'turtle'` and `Today's top 5` renders candidate rows
- **THEN** the table displays `Ticker`, `Close`, `Breakout 20d` (`strategy_props.donchian_high_20`), `N (ATR%)` (`strategy_props.n_value` and `strategy_props.atr_pct`), `Stop (2N)` (`stop_loss`), and `Action` (when authenticated), with `-` fallback for missing fields.

#### Scenario: Rendering Live Positions columns for Turtle strategy
- **WHEN** `activeStrategy` is `'turtle'` and `Live Positions` renders open real trades
- **THEN** the `TARGET` column is replaced with `UNITS` (e.g., `2/4` from `strategy_props.units` and `strategy_props.max_units`) and `NEXT PYRAMID` (`strategy_props.next_pyramid_price`, or `Max` when `units >= max_units`).

## MODIFIED Requirements

### Requirement: Theoretical Trades Status Sub-Tabs
The frontend SHALL provide sub-tabs in the `Theoretical Trades` panel (Column 2) to toggle between closed backtest trades and currently open simulated positions, rendering strategy-appropriate columns for open positions.

#### Scenario: Switching between Closed and Open theoretical trades
- **WHEN** the user selects the `Abiertos (En Curso)` sub-tab in the `Theoretical Trades` panel
- **THEN** the table displays records from `trades` where `taken = false`, `strategy = activeStrategy`, and `status = 'OPEN'` using Kotegawa open position columns (`ticker`, `entry_date`, `entry_price`, `target`, `stop_loss`) when `activeStrategy` is `'kotegawa'`, or Turtle open position columns (`ticker`, `entry_date`, `entry_price`, `units`, `next_pyramid_price`, `stop_loss`) when `activeStrategy` is `'turtle'`, and switches back to closed trades (`status = 'CLOSED'`) when `Cerrados (Historial)` is selected.

### Requirement: Read-Only Screener and Trade Tables Hydration
The frontend SHALL asynchronously fetch screener candidates and categorized trade history records filtered by `activeStrategy`, and compute strategy-agnostic performance KPIs.

#### Scenario: Displaying latest screener candidates
- **WHEN** the user views the Screener Engine column
- **THEN** the system fetches candidate records from `screener_candidates` filtered by `strategy = activeStrategy` and the latest `created_at` timestamp for that strategy, rendering them in order of descending `score`.

#### Scenario: Displaying theoretical backtest performance
- **WHEN** the user views the Theoretical Performance column
- **THEN** the system fetches records from `trades` where `taken = false` and `strategy = activeStrategy`, renders closed and open mock positions, and computes Win Rate as the percentage of closed trades with `Number(pnl_percent) > 0` (regardless of `exit_reason` such as `TP` or `TRAILING_STOP`), Cumulative PnL, Avg Days Held, and `Avg RRR` (`"1 : 0.85"` for `'kotegawa'`, `"-"` for `'turtle'`).

#### Scenario: Displaying real portfolio positions and history
- **WHEN** the user views the Real Portfolio column
- **THEN** the system queries `trades` where `taken = true` and `strategy = activeStrategy`, segregating records by `status = 'OPEN'` (Live Positions) and `status = 'CLOSED'` (Trade History) in read-only mode.

### Requirement: Compact-First Responsive Header for Medium and Laptop Viewports
The frontend Header SHALL render a compact card layout by default on screens smaller than `2xl` (`< 1536px`) to minimize vertical height consumption and prevent text wrapping, progressively revealing extended labels, help icons, and larger paddings at `xl` (`>= 1280px`) and `2xl` (`>= 1536px`) breakpoints, while keeping the strategy selector visible and usable at all breakpoints.

#### Scenario: Compact labels and reduced height on laptop viewports (< 2xl)
- **WHEN** the dashboard is rendered on a viewport width below `1536px` (`< 2xl`, such as `1366x768`)
- **THEN** the Header cards apply compact padding (`p-2`), abbreviated titles (`SPY` instead of `S&P 500 (SPY)` and `VIX` instead of `Volatility Index`), scaled-down logo and clock icons, and single-line Cronjob date/time formatting without line wraps

#### Scenario: Progressive disclosure at xl breakpoint (< 1280px vs >= 1280px)
- **WHEN** the dashboard is rendered on a viewport width below `1280px` (`< xl`)
- **THEN** secondary header elements (`Swing trading dashboard` subtitle, VIX `(?)` tooltip trigger, `Bullish participation` subtitle, `Cronjob` title label, and the clock icon) remain hidden and become visible at `xl:` (`>= 1280px`)

#### Scenario: Expanded full-detail header on large monitors (2xl+)
- **WHEN** the dashboard is rendered on a viewport width of `1536px` or greater (`2xl:`)
- **THEN** the Header displays full titles (`S&P 500 (SPY)`, `Volatility Index`), generous card padding (`2xl:p-3`), larger typography (`2xl:text-2xl`), and two-line Cronjob date and time display

#### Scenario: Strategy selector visibility in compact mode (< lg)
- **WHEN** the dashboard is rendered on a viewport width below `1024px` (`< lg`) where the `Stock Screener` title is hidden
- **THEN** Card 1 in the Header keeps the `Kotegawa` / `Turtle` segmented selector visible and interactive alongside the logo without overflowing the 3-column header grid.
