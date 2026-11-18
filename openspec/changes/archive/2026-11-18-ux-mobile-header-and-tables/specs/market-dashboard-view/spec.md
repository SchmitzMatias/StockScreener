# Spec Delta

## MODIFIED Requirements

### Requirement: Conditional Desktop Fixed-Viewport Layout and Internal Table Scroll
The frontend SHALL lock the main application layout to the viewport height (`100vh`) with isolated internal scrolling on desktop screens (`md:` breakpoint and above), while preserving natural full-page vertical scrolling across stacked widgets on mobile screens (`< md`) with bounded table container heights (`max-h-80`) and internal vertical scrolling.

#### Scenario: Desktop fixed viewport and isolated column scrolling (md+)
- **WHEN** the dashboard is viewed on a viewport width `>= 768px` (`md:`)
- **THEN** the root container locks to `md:h-screen md:overflow-hidden`, keeping the macro Header, column titles, sub-tabs, and KPI footers static while vertical scrolling occurs exclusively inside each column's table or form containers (`md:max-h-none`)

#### Scenario: Mobile natural page scroll (< md)
- **WHEN** the dashboard is viewed on a viewport width `< 768px`
- **THEN** viewport height and overflow locks remain inactive on the root container so stacked widgets flow naturally down the page, while each `DataTable` container is bounded to `max-h-80` (`320px`) with internal vertical scrolling (`overflow-y-auto`) to prevent infinite page expansion

#### Scenario: Always-sticky table column headers
- **WHEN** a user scrolls vertically through any `DataTable` on either mobile or desktop viewports
- **THEN** the table header (`<thead>`) remains pinned at the top of the table container via `sticky top-0 bg-panel z-10`

### Requirement: Compact-First Responsive Header for Medium and Laptop Viewports
The frontend Header SHALL render a compact card layout by default on screens smaller than `2xl` (`< 1536px`) to minimize vertical height consumption and prevent text wrapping, progressively revealing extended labels, help icons, and larger paddings at `xl` (`>= 1280px`) and `2xl` (`>= 1536px`) breakpoints, hiding secondary macro cards on mobile (`< md`), and keeping the strategy selector visible and usable at all breakpoints.

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
- **THEN** on mobile (`< md`) the Header uses a 2-column grid (`grid-cols-2`), hides the `Bullish participation` (SMA20) card (`hidden md:flex`) alongside SPY (`hidden lg:flex`), spans Card 1 (`Logo` + `Kotegawa` / `Turtle` selector) across both columns (`col-span-2`) on Row 1, and renders VIX and Cronjob side-by-side on Row 2 without horizontal overflow; on tablet (`md` to `< lg`) it uses `md:grid-cols-4` with Card 1 (`md:col-span-1`), VIX, SMA20 (`md:flex`), and Cronjob in a single row
