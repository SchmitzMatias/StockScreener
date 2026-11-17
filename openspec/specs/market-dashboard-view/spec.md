# market-dashboard-view Specification

## Purpose

Extiende la visualización del dashboard para permitir inspeccionar posiciones teóricas abiertas vs. cerradas mediante sub-tabs y contrastar las métricas del portafolio real frente al backtest.

## Requirements

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

### Requirement: Complete Macro Widgets Hydration from Supabase
The frontend Header SHALL read all macroeconomic metrics (`spy_price`, `spy_change`, `spy_history`, `vix_price`, `vix_change`, `sma20_bull_pct`, `last_run` or `updated_at`) exclusively from `public.market_metadata` in Supabase without any local JSON fetch remnants.

#### Scenario: Rendering SPY SparkLine from JSONB array
- **WHEN** the macro Header receives a `market_metadata` record containing a non-empty `spy_history` numeric array (or serialized JSON array)
- **THEN** the frontend normalizes the array defensively and renders the `SparkLine` chart using the first price entry as the baseline

#### Scenario: Inverted color semantics for VIX daily change
- **WHEN** the Volatility Index card renders `vix_change`
- **THEN** positive changes (`+`) are styled with `text-danger` and negative changes (`-`) are styled with `text-accent`

### Requirement: Conditional Desktop Fixed-Viewport Layout and Internal Table Scroll
The frontend SHALL lock the main application layout to the viewport height (`100vh`) with isolated internal scrolling on desktop screens (`md:` breakpoint and above), while preserving natural full-page vertical scrolling on mobile screens (`< md`).

#### Scenario: Desktop fixed viewport and isolated column scrolling (md+)
- **WHEN** the dashboard is viewed on a viewport width `>= 768px` (`md:`)
- **THEN** the root container locks to `md:h-screen md:overflow-hidden`, keeping the macro Header, column titles, sub-tabs, and KPI footers static while vertical scrolling occurs exclusively inside each column's table or form containers

#### Scenario: Mobile natural page scroll (< md)
- **WHEN** the dashboard is viewed on a viewport width `< 768px`
- **THEN** viewport height and overflow locks remain inactive and the page flows vertically with natural full-page scrolling across stacked widgets

#### Scenario: Always-sticky table column headers
- **WHEN** a user scrolls vertically through any `DataTable` on either mobile or desktop viewports
- **THEN** the table header (`<thead>`) remains pinned at the top of the table container via `sticky top-0 bg-panel z-10`

### Requirement: Compact-First Responsive Header for Medium and Laptop Viewports
The frontend Header SHALL render a compact card layout by default on screens smaller than `2xl` (`< 1536px`) to minimize vertical height consumption and prevent text wrapping, progressively revealing extended labels, help icons, and larger paddings at `xl` (`>= 1280px`) and `2xl` (`>= 1536px`) breakpoints.

#### Scenario: Compact labels and reduced height on laptop viewports (< 2xl)
- **WHEN** the dashboard is rendered on a viewport width below `1536px` (`< 2xl`, such as `1366x768`)
- **THEN** the Header cards apply compact padding (`p-2`), abbreviated titles (`SPY` instead of `S&P 500 (SPY)` and `VIX` instead of `Volatility Index`), scaled-down logo and clock icons, and single-line Cronjob date/time formatting without line wraps

#### Scenario: Progressive disclosure at xl breakpoint (< 1280px vs >= 1280px)
- **WHEN** the dashboard is rendered on a viewport width below `1280px` (`< xl`)
- **THEN** secondary header elements (`Swing trading dashboard` subtitle, VIX `(?)` tooltip trigger, `Bullish participation` subtitle, `Cronjob` title label, and the clock icon) remain hidden and become visible at `xl:` (`>= 1280px`)

#### Scenario: Expanded full-detail header on large monitors (2xl+)
- **WHEN** the dashboard is rendered on a viewport width of `1536px` or greater (`2xl:`)
- **THEN** the Header displays full titles (`S&P 500 (SPY)`, `Volatility Index`), generous card padding (`2xl:p-3`), larger typography (`2xl:text-2xl`), and two-line Cronjob date and time display

### Requirement: Headerless Three-Column Dashboard Layout
The frontend Dashboard SHALL render its three main columns directly with their internal `WidgetPanel` containers without outer column-level title headers or double-bordered column wrappers, preserving full vertical height allocation and internal scrolling on desktop viewports (`md:`).

#### Scenario: Rendering columns without redundant top headers
- **WHEN** the user views the main 3-column grid in the Dashboard
- **THEN** the columns display their `WidgetPanel` headers (`Today's top 5`, `Trading Journal`, `Theoretical Trades`, `Live Positions`, `Trade History`) directly at the top edge of the grid without rendering `"1. Screener Engine"`, `"2. Theoretical Performance"`, or `"3. Real Portfolio"` headers

#### Scenario: Preserving flexbox height constraint and internal table scrolling
- **WHEN** the outer column header wrapper is removed on desktop viewports (`md:` and above)
- **THEN** each column container maintains `flex flex-col gap-3 md:h-full md:min-h-0 md:overflow-hidden` so internal `WidgetPanel` tables and forms expand to fill the reclaimed ~50px of vertical height and scroll independently
