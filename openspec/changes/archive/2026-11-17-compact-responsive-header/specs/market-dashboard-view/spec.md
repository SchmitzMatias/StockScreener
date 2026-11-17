# Spec Delta

## ADDED Requirements

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
