# Spec Delta

## Purpose

Garantiza la persistencia relacional completa del historial de precios de SPY en formato JSONB dentro de la tabla `market_metadata` de Supabase sin pérdida de datos en reintentos de esquema.

## ADDED Requirements

### Requirement: Complete SPY History JSONB Persistence in Market Metadata
The system SHALL store the historical SPY closing price array (~20-22 trading sessions) into the `spy_history` `JSONB` column of `public.market_metadata` on every pipeline run and migration execution without omitting it during fallback retries.

#### Scenario: Upserting spy_history array in daily pipeline
- **WHEN** the backend metadata persistence step executes (`persist_market_metadata`)
- **THEN** `spy_history` is included in the base payload as a sanitized JSON-compatible numeric array alongside `vix_price`, `vix_change`, `sma20_bull_pct`, `spy_price`, and `spy_change` so fallback retries never strip historical prices

#### Scenario: Schema patch compatibility in Supabase
- **WHEN** the SQL schema migration is applied to `public.market_metadata`
- **THEN** the `spy_history` (`JSONB DEFAULT '[]'::jsonb`) and `last_run` (`TEXT`) columns exist and the PostgREST schema cache is reloaded via `NOTIFY pgrst, 'reload schema'`
