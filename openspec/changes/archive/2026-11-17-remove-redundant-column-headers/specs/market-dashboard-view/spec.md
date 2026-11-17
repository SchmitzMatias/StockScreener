# Spec Delta

## ADDED Requirements

### Requirement: Headerless Three-Column Dashboard Layout
The frontend Dashboard SHALL render its three main columns directly with their internal `WidgetPanel` containers without outer column-level title headers or double-bordered column wrappers, preserving full vertical height allocation and internal scrolling on desktop viewports (`md:`).

#### Scenario: Rendering columns without redundant top headers
- **WHEN** the user views the main 3-column grid in the Dashboard
- **THEN** the columns display their `WidgetPanel` headers (`Today's top 5`, `Trading Journal`, `Theoretical Trades`, `Live Positions`, `Trade History`) directly at the top edge of the grid without rendering `"1. Screener Engine"`, `"2. Theoretical Performance"`, or `"3. Real Portfolio"` headers

#### Scenario: Preserving flexbox height constraint and internal table scrolling
- **WHEN** the outer column header wrapper is removed on desktop viewports (`md:` and above)
- **THEN** each column container maintains `flex flex-col gap-3 md:h-full md:min-h-0 md:overflow-hidden` so internal `WidgetPanel` tables and forms expand to fill the reclaimed ~50px of vertical height and scroll independently
