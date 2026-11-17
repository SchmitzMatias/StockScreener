# Tasks: Frontend Multi-Estrategia (Kotegawa & Turtle) — Fase B

## 1. Estado Global y Selector de Estrategia en Header

- [x] 1.1 Definir el tipo `StrategyType = 'kotegawa' | 'turtle'` (y exportarlo desde `DashboardTables.tsx`), inicializar `activeStrategy` en `frontend/src/App.tsx` con default `'kotegawa'`, y pasarlo por props a `Header` y `Dashboard`; verificar compilación TypeScript sin errores (`npx tsc --noEmit`).
- [x] 1.2 Implementar el Segmented Control (`Kotegawa` / `Turtle`) en la primera tarjeta de `frontend/src/components/Header.tsx` fuera del bloque `hidden lg:block`, asegurando visibilidad y usabilidad tanto en modo compacto (`< lg`) como en desktop (`lg+`), y verificar visualmente en ambos breakpoints.

## 2. Filtrado de Consultas y KPIs en Dashboard

- [x] 2.1 Actualizar `fetchDashboardData` en `frontend/src/components/Dashboard/Dashboard.tsx` para filtrar `screener_candidates` y `trades` con `.eq('strategy', activeStrategy)`, agregar `activeStrategy` a las dependencias del `useCallback`, y limpiar `selectedCandidate` y `closingTrade` al cambiar de estrategia; verificar en Network/UI que al alternar estrategia se recargan datos específicos de cada una.
- [x] 2.2 Corregir el cálculo de `Win Rate` teórico en `frontend/src/components/Dashboard/Dashboard.tsx` usando `Number(t.pnl_percent) > 0` en lugar de `t.exit_reason === 'TP'`, y mostrar `Avg RRR` como `"-"` cuando `activeStrategy === 'turtle'`; verificar que el Win Rate refleja trades ganadores cerrados por `TRAILING_STOP` o `TP`.

## 3. Tablas Dinámicas desde `strategy_props`

- [x] 3.1 Actualizar `Top5Candidate` y `getTop5Columns(strategy, onQuickAdd)` en `frontend/src/components/Dashboard/DashboardTables.tsx` para renderizar `Ticker | Close | Breakout 20d | N (ATR%) | Stop (2N) | Action` cuando `strategy === 'turtle'`, leyendo `donchian_high_20`, `n_value` y `atr_pct` desde `strategy_props` con fallback `'-'`; verificar renderizado en `Today's top 5` bajo ambas estrategias.
- [x] 3.2 Actualizar `getLivePositionsColumns(strategy, onCloseTrade, onPyramidTrade)` en `frontend/src/components/Dashboard/DashboardTables.tsx` para reemplazar `TARGET` por `UNITS` (`units/max_units`) y `NEXT PYRAMID` (`next_pyramid_price` o `'Max'`) cuando `strategy === 'turtle'`, y pasar `activeStrategy` tanto en `Live Positions` como en `Theoretical Trades -> Abiertos (En Curso)` dentro de `Dashboard.tsx`; verificar ambas tablas bajo `'kotegawa'` y `'turtle'`.
- [x] 3.3 En `getLivePositionsColumns`, renderizar el botón secundario `[+ Unidad]` junto a `[Cerrar]` únicamente cuando `strategy === 'turtle'`, `onPyramidTrade` esté definido (operador autenticado) y `Number(item.strategy_props?.units ?? 1) < Number(item.strategy_props?.max_units ?? 4)`; verificar que desaparece en `'kotegawa'`, en modo lectura o cuando `units >= max_units`.

## 4. Bitácora Manual, Cierre y Piramidación en Tiempo Real

- [x] 4.1 Actualizar `frontend/src/components/Dashboard/TradeEntryForm.tsx` para recibir `activeStrategy`, sincronizar el estado `strategy`, hacer `target` opcional (`null` en Supabase) cuando `strategy === 'turtle'`, e inicializar `strategy_props` de seguimiento Tortuga (`units: 1`, `max_units: 4`, `unit_fills`, `n_at_entry`, `stop_2n`, `trailing_stop_10d`, `next_pyramid_price`) al crear trades desde Quick-Add o manualmente; verificar inserción en `public.trades` con `target = null` bajo `'turtle'`.
- [x] 4.2 Actualizar `frontend/src/components/Dashboard/CloseTradeModal.tsx` para incluir `'TRAILING_STOP'` en `ExitReason` y en el `<select>` de motivo de salida, preseleccionándolo por defecto cuando `trade.strategy === 'turtle'`; verificar que el cierre guarda `exit_reason = 'TRAILING_STOP'`.
- [x] 4.3 Crear `frontend/src/components/Dashboard/PyramidTradeModal.tsx` e integrarlo en `Dashboard.tsx` para pedir únicamente `fill_price`, calcular `new_units`, `new_entry_price` (promedio ponderado), `new_stop_2n`, `new_effective_stop = max(new_stop_2n, trailing_stop_10d)` y `next_pyramid_price`, ejecutar el `UPDATE` en `public.trades` (`taken = true`) y refrescar el dashboard; verificar el recálculo exacto en UI y base de datos tras piramidar una posición real.

## 5. Verificación Final de Integración

- [x] 5.1 Ejecutar `npm run build` y `npx tsc --noEmit` en `frontend/` para confirmar cero errores de tipos o empaquetado tras todos los cambios.
