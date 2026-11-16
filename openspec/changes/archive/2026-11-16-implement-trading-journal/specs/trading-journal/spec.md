# Spec Delta

## Purpose

Provee el flujo de bitácora operativa (*Trading Journal*) en el frontend para autenticar al operador, registrar nuevas posiciones reales (`taken = true`) manualmente o desde candidatos del screener (*Quick-Add*), y liquidar posiciones abiertas mediante un modal de cierre bajo políticas RLS estrictas.

## ADDED Requirements

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
The frontend SHALL allow the authenticated operator to log a new real trade (`taken = true`, `status = 'OPEN'`) via the embedded `TradeEntryForm` in Column 1, either manually or pre-populated from a screener candidate without recalculating financial targets.

#### Scenario: Quick-Add from Today's Top 5 table
- **WHEN** the authenticated operator clicks the `+ Tomar` button on a candidate row in the `Today's top 5` table
- **THEN** the embedded `TradeEntryForm` automatically populates `ticker`, `entry_price` (with the candidate's `close_price`), `target`, and `stop_loss` with the exact values from the candidate without executing any automatic RRR recalculation if the operator subsequently edits `entry_price`.

#### Scenario: Submitting a new real trade
- **WHEN** the authenticated operator submits `TradeEntryForm` with valid `ticker`, `entry_date`, `entry_price`, `target`, `stop_loss`, and optional `notes`
- **THEN** the system inserts a new record into `public.trades` with `taken = true`, `status = 'OPEN'`, `strategy = 'kotegawa'`, and `strategy_props = { notes }`, clears the form, and refreshes the `Live Positions` table.

### Requirement: Manual Trade Closure via Lightweight Modal
The frontend SHALL provide a modal workflow (`CloseTradeModal`) to close an open real position from the `Live Positions` table.

#### Scenario: Closing an active real position
- **WHEN** the authenticated operator clicks `Cerrar` on an open position in `Live Positions` and submits the modal with `exit_price`, `exit_date`, `exit_reason` (`TP`, `SL`, `MANUAL`, or `TIME_STOP`), and optional `exit_notes`
- **THEN** the system updates the corresponding `public.trades` record (`id`, `taken = true`) setting `status = 'CLOSED'`, `exit_price`, `exit_date`, `exit_reason`, `pnl_percent`, `days_held`, and merged `strategy_props`, and refreshes both `Live Positions` and `Trade History`.
