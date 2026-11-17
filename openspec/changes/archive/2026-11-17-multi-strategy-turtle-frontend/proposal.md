# Proposal: Frontend Multi-Estrategia (Kotegawa & Turtle) — Fase B

## Why

La Fase A (`multi-strategy-turtle-backend`) ya ejecuta diariamente tanto la estrategia `kotegawa` (Mean Reversion) como `turtle` (Trend Following) y persiste sus candidatos, trades teóricos y metadata en `strategy_props` (`JSONB`) en Supabase. Sin embargo, el frontend React aún consulta las tablas sin filtrar por estrategia, asume columnas fijas de Kotegawa, exige `target` obligatorio en la bitácora y no permite registrar piramidaciones manuales en posiciones reales abiertas, lo que dejaría desactualizado el Stop Loss efectivo en la UI frente al riesgo real.

## What Changes

- **Estado global y selector de estrategia (`App.tsx`, `Header.tsx`):** Incorporar `activeStrategy` (`'kotegawa' | 'turtle'`, default `'kotegawa'`) en `App.tsx` y un Segmented Control en la primera tarjeta de `Header.tsx` junto al logo, preservando el diseño compacto en pantallas pequeñas (`< lg`).
- **Consultas filtradas y KPIs agnósticos (`Dashboard.tsx`):** Filtrar `screener_candidates` y `trades` por `.eq('strategy', activeStrategy)`, limpiar selecciones activas al cambiar de estrategia, calcular el `Win Rate` teórico por `Number(t.pnl_percent) > 0` (en lugar de `exit_reason === 'TP'`) y adaptar `Avg RRR` cuando la estrategia activa sea `turtle`.
- **Tablas dinámicas con lectura de `strategy_props` (`DashboardTables.tsx`):**
  - `Today's top 5`: bajo `'turtle'`, mostrar `Ticker | Close | Breakout 20d | N (ATR%) | Stop (2N) | Action`.
  - `Live Positions` y `Theoretical Trades -> Abiertos (En Curso)`: bajo `'turtle'`, reemplazar `TARGET` por `UNITS` (ej. `2/4`) y `NEXT PYRAMID` leyendo `strategy_props.units`, `strategy_props.max_units` y `strategy_props.next_pyramid_price`.
- **Bitácora manual multi-estrategia (`TradeEntryForm.tsx`, `CloseTradeModal.tsx`):**
  - Pasar `activeStrategy` a `TradeEntryForm` para insertar bajo la estrategia activa y hacer `target` opcional (`null` en Supabase) cuando la estrategia sea `'turtle'`.
  - Agregar `'TRAILING_STOP'` como motivo de salida en `CloseTradeModal.tsx` (preseleccionado por defecto para trades `'turtle'`).
- **Piramidación manual en posiciones reales (`DashboardTables.tsx`, `PyramidTradeModal.tsx`):**
  - En `Live Positions`, cuando `activeStrategy === 'turtle'` y `units < max_units` (y el operador esté autenticado), mostrar el botón secundario `[+ Unidad]` junto a `[Cerrar]`.
  - Abrir un modal liviano que solicite únicamente `fill_price` y ejecute un `UPDATE` en `public.trades` (`taken = true`) recalculando el promedio ponderado (`entry_price`), `stop_2n`, `stop_loss` efectivo (`max(stop_2n, trailing_stop_10d)`), `next_pyramid_price`, `units` y `unit_fills` con la misma fórmula del backend.

## Capabilities

### New Capabilities

<!-- Ninguna capacidad nueva independiente; se extienden las capacidades existentes de visualización y bitácora. -->

### Modified Capabilities

- `market-dashboard-view`: Selector global de estrategia en Header compacto, filtrado por `strategy` en consultas Supabase, cálculo de Win Rate por PnL positivo y renderizado dinámico de columnas desde `strategy_props` para `turtle`.
- `trading-journal`: Creación de trades reales bajo `activeStrategy` con `target` opcional para `turtle`, piramidación manual (`[+ Unidad]`) con recálculo de precio promedio y stop efectivo, y soporte de motivo `TRAILING_STOP` al cerrar posiciones.

## Impact

- **Archivos modificados:** `frontend/src/App.tsx`, `frontend/src/components/Header.tsx`, `frontend/src/components/Dashboard/Dashboard.tsx`, `frontend/src/components/Dashboard/DashboardTables.tsx`, `frontend/src/components/Dashboard/TradeEntryForm.tsx`, `frontend/src/components/Dashboard/CloseTradeModal.tsx`.
- **Archivos nuevos:** `frontend/src/components/Dashboard/PyramidTradeModal.tsx` (o componente modal equivalente en `Dashboard/`).
- **Backend / Base de datos:** Sin cambios (consume el esquema `strategy` y `strategy_props` ya desplegado en Fase A).
