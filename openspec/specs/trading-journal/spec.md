# trading-journal Specification

## Purpose

Provee el flujo de bitácora operativa (*Trading Journal*) en el frontend para autenticar al operador, registrar nuevas posiciones reales (`taken = true`) manualmente o desde candidatos del screener (*Quick-Add*), y liquidar posiciones abiertas mediante un modal de cierre bajo políticas RLS estrictas.

## Requirements

### Requirement: Single-Operator Authentication Gate for Write Operations
The frontend SHALL authenticate the operator via Supabase Auth (Email/Password) before enabling trade creation or closure, while preserving public read-only access for unauthenticated visitors.

#### Scenario: Unauthenticated visitor views the dashboard
- **WHEN** a user accesses the dashboard without an active Supabase Auth session
- **THEN** all market metadata, screener candidates, theoretical trades, and real portfolio tables render normally in read-only mode, while the `Trading Journal` panel displays an operator login form (`email` and `password`) and table action buttons (`+ Tomar`, `Cerrar`) are hidden or disabled.

#### Scenario: Operator signs in with valid credentials
- **WHEN** the operator submits valid credentials in the `Trading Journal` login form
- **THEN** the system authenticates via `supabase.auth.signInWithPassword`, unlocks the embedded `TradeEntryForm`, and enables the `+ Tomar` and `Cerrar` action buttons across the dashboard.

### Requirement: RLS Enforcement on Real Trades Only
The database SHALL enforce Row Level Security (RLS) policies on `public.trades` such that client-side `INSERT` and `UPDATE` operations are restricted to authenticated users and strictly scoped to records where `taken = true`.

#### Scenario: Authenticated insertion of a real trade
- **WHEN** an authenticated client inserts a record into `public.trades` with `taken = true`
- **THEN** the RLS policy permits the insertion.

#### Scenario: Attempted insertion or modification of a theoretical trade from client
- **WHEN** any client using `anon_key` (even with an authenticated session) attempts to `INSERT` or `UPDATE` a record in `public.trades` with `taken = false`
- **THEN** PostgreSQL rejects the operation via the `USING (taken = true)` and `WITH CHECK (taken = true)` RLS policy constraints.

### Requirement: Embedded Real Trade Entry and Screener Quick-Add
The frontend SHALL allow the authenticated operator to log a new real trade (`taken = true`, `status = 'OPEN'`) via the embedded `TradeEntryForm` in Column 1 under the active strategy, either manually or pre-populated from a screener candidate without recalculating financial targets.

#### Scenario: Quick-Add from Today's Top 5 table
- **WHEN** the authenticated operator clicks the `+ Tomar` button on a candidate row in the `Today's top 5` table
- **THEN** the embedded `TradeEntryForm` automatically populates `ticker`, `strategy` (from `candidate.strategy ?? activeStrategy`), `entry_price` (with the candidate's `close_price`), `target` (empty if `null`), and `stop_loss` with the exact values from the candidate without executing any automatic RRR recalculation if the operator subsequently edits `entry_price`.

#### Scenario: Submitting a new real trade
- **WHEN** the authenticated operator submits `TradeEntryForm` under `'kotegawa'` with valid `ticker`, `entry_date`, `entry_price`, `target > 0`, `stop_loss > 0`, and optional `notes`
- **THEN** the system inserts a new record into `public.trades` with `taken = true`, `status = 'OPEN'`, `strategy = 'kotegawa'`, `target`, and `strategy_props = { notes }`, clears the form, and refreshes the `Live Positions` table.

#### Scenario: Submitting a new real trade for Turtle with optional target
- **WHEN** the authenticated operator submits `TradeEntryForm` under `'turtle'` with valid `ticker`, `entry_date`, `entry_price`, `stop_loss > 0`, optional `target` (empty or `> 0`), and optional `notes`
- **THEN** the system inserts a new record into `public.trades` with `taken = true`, `status = 'OPEN'`, `strategy = 'turtle'`, `target: null` (when left empty), and `strategy_props` initialized with `notes` plus Turtle tracking metadata (`units: 1`, `max_units: 4`, `unit_fills: [entry_price]`, `n_at_entry`, `stop_2n`, `trailing_stop_10d`, `next_pyramid_price` when available from `selectedCandidate`), clears the form, and refreshes `Live Positions`.

### Requirement: Manual Trade Closure via Lightweight Modal
The frontend SHALL provide a modal workflow (`CloseTradeModal`) to close an open real position from the `Live Positions` table, supporting exit reasons for both Kotegawa and Turtle strategies.

#### Scenario: Closing an active real position
- **WHEN** the authenticated operator clicks `Cerrar` on an open position in `Live Positions` and submits the modal with `exit_price`, `exit_date`, `exit_reason` (`TP`, `SL`, `TRAILING_STOP`, `MANUAL`, or `TIME_STOP`), and optional `exit_notes`
- **THEN** the system updates the corresponding `public.trades` record (`id`, `taken = true`) setting `status = 'CLOSED'`, `exit_price`, `exit_date`, `exit_reason`, `pnl_percent`, `days_held`, and merged `strategy_props`, and refreshes both `Live Positions` and `Trade History`.

#### Scenario: Default exit reason for Turtle positions
- **WHEN** the authenticated operator opens `CloseTradeModal` for a position where `trade.strategy === 'turtle'`
- **THEN** the `Motivo de Salida` selector includes `TRAILING_STOP` and defaults to `'TRAILING_STOP'` instead of `'TP'`.

### Requirement: Manual Pyramiding for Active Turtle Positions
The frontend SHALL allow the authenticated operator to record a manual pyramid unit addition on an open real Turtle position (`taken = true`, `strategy = 'turtle'`, `status = 'OPEN'`) when `units < max_units`, recalculating weighted entry price and effective stop loss in Supabase.

#### Scenario: Displaying the pyramid action button on eligible Turtle positions
- **WHEN** `activeStrategy` is `'turtle'`, the operator is authenticated, and an open row in `Live Positions` has `Number(strategy_props?.units ?? 1) < Number(strategy_props?.max_units ?? 4)`
- **THEN** the `ACTION` column renders a secondary `[+ Unidad]` button alongside `[Cerrar]`.

#### Scenario: Hiding the pyramid action button at max units or in Kotegawa
- **WHEN** `activeStrategy` is `'kotegawa'`, the user is unauthenticated, or a Turtle position already has `units >= max_units`
- **THEN** the `[+ Unidad]` button is not rendered for that row.

#### Scenario: Submitting a pyramid fill price and recalculating risk
- **WHEN** the authenticated operator clicks `[+ Unidad]`, enters a valid `fill_price > 0` in the pyramid modal, and submits
- **THEN** the system computes `new_units = old_units + 1`, `new_entry_price = ((old_entry * old_units) + fill_price) / new_units`, `new_stop_2n = fill_price - (2.0 * n_at_entry)`, `new_effective_stop = max(new_stop_2n, trailing_stop_10d)`, and `next_pyramid_price = new_units < max_units ? fill_price + (0.5 * n_at_entry) : null`, updates `entry_price`, `stop_loss`, and `strategy_props` (`units`, `unit_fills`, `stop_2n`, `next_pyramid_price`) on that `public.trades` record (`taken = true`), closes the modal, and refreshes dashboard data.
