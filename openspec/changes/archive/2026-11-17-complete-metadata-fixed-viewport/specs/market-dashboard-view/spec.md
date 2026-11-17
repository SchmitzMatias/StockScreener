# Spec Delta

## ADDED Requirements

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
