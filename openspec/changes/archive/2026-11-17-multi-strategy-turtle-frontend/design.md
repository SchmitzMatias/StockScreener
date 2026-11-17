# Design: Frontend Multi-Estrategia (Kotegawa & Turtle) — Fase B

## Context

Ver `proposal.md` para la motivación completa. El backend (Fase A) persiste candidatos y trades bajo `strategy IN ('kotegawa', 'turtle')` con metadata específica en `strategy_props` (`JSONB`). El frontend actual (`App.tsx`, `Header.tsx`, `Dashboard.tsx`, `DashboardTables.tsx`, `TradeEntryForm.tsx`, `CloseTradeModal.tsx`) asume un flujo único para `kotegawa` y no expone selector de estrategia ni acciones de piramidación.

## Goals / Non-Goals

**Goals:**
- Inyectar `activeStrategy: StrategyType` (`'kotegawa' | 'turtle'`) en `App.tsx` con selector accesible en `Header.tsx` sin romper el layout compacto (`< lg`).
- Filtrar las consultas de `Dashboard.tsx` por `strategy = activeStrategy`, corregir `Win Rate` teórico a `Number(t.pnl_percent) > 0` y adaptar `Avg RRR` para Tortugas.
- Renderizar columnas dinámicas en `DashboardTables.tsx` leyendo `strategy_props` tanto en `Today's top 5` como en `Live Positions` y `Theoretical Trades -> Abiertos (En Curso)`.
- Adaptar `TradeEntryForm.tsx` (`target` opcional para `'turtle'`) y `CloseTradeModal.tsx` (soporte de `'TRAILING_STOP'`).
- Implementar `PyramidTradeModal.tsx` y acción `[+ Unidad]` en `Live Positions` para mantener sincronizado el precio promedio ponderado y el Stop Loss efectivo de posiciones reales Tortuga.

**Non-Goals:**
- Creación o edición de reglas de backend Python o migraciones SQL en Supabase.
- Edición manual de múltiples campos de `strategy_props` fuera de `fill_price` en piramidación y `notes` en alta/cierre.
- Piramidación sobre trades teóricos (`taken = false`), ya que estos son actualizados automáticamente por `evaluate_open_trades` en el backend.

## Decisions

### 1. Estado Global en `App.tsx` vs Context API
- **Decisión:** Elevar `activeStrategy` a `App.tsx` y pasarlo por props a `Header` y `Dashboard` (y de `Dashboard` a `TradeEntryForm` y factorías de columnas).
- **Alternativa considerada:** React Context (`StrategyContext`). Descartada porque el árbol tiene solo 2 niveles de profundidad (`App -> Dashboard -> TradeEntryForm`), por lo que props explícitas son más simples, tipadas y fáciles de auditar.

### 2. Selector UI en `Header.tsx` compatible con Modo Compacto
- **Decisión:** Usar un Segmented Control compacto de 2 botones (`Kotegawa` / `Turtle`) dentro de Card 1, fuera del bloque `hidden lg:block` del título, para que sea visible e interactivo tanto en `< lg` (junto al logo) como en `lg+` (debajo del título o alineado en columna).
- **Alternativa considerada:** Dropdown `<select>` nativo. Descartado porque un Segmented Control de 2 opciones ofrece cambio en 1 clic y feedback visual inmediato de la estrategia activa.

### 3. Inicialización de `strategy_props` al crear trades reales Turtle
- **Decisión:** Cuando el operador usa Quick-Add (`+ Tomar`) desde un candidato `turtle`, `TradeEntryForm` copia `n_value` (`n_at_entry`), `donchian_low_10` (`trailing_stop_10d`), `donchian_high_20` (`donchian_high_20_entry`) y calcula `stop_2n` / `next_pyramid_price` inicial junto con `units: 1`, `max_units: 4`, `unit_fills: [entryPrice]`. Si el operador crea un trade `turtle` 100% manual (sin `selectedCandidate`), inicializa `units: 1`, `max_units: 4`, `unit_fills: [entryPrice]` y `stop_2n: stopLossNum` (con `n_at_entry: null` si no se conoce, o inferido como `(entryPrice - stopLossNum) / 2` solo si `entryPrice > stopLossNum` como fallback seguro para habilitar futuras piramidaciones).
- **Alternativa considerada:** Guardar solo `{ notes }` en `strategy_props`. Descartada porque sin `n_at_entry`, `units` y `trailing_stop_10d`, el botón `[+ Unidad]` no tendría base matemática para recalcular `stop_2n` y `next_pyramid_price`.

### 4. Cálculo exacto de Piramidación Manual en `PyramidTradeModal.tsx`
- **Decisión:** Replicar en TypeScript la fórmula exacta del backend (`evaluate_open_trades`):
  - `oldUnits = Number(props.units ?? 1)`
  - `maxUnits = Number(props.max_units ?? 4)`
  - `oldEntry = Number(trade.entry_price)`
  - `nAtEntry = Number(props.n_at_entry ?? (oldEntry > Number(trade.stop_loss) ? (oldEntry - Number(trade.stop_loss)) / 2 : 0))`
  - `trailingStop10d = Number(props.trailing_stop_10d ?? trade.stop_loss ?? 0)`
  - `newUnits = oldUnits + 1`
  - `newEntryPrice = Number((((oldEntry * oldUnits) + fillPrice) / newUnits).toFixed(2))`
  - `newStop2n = Number((fillPrice - 2.0 * nAtEntry).toFixed(2))`
  - `newEffectiveStop = Number(Math.max(newStop2n, trailingStop10d).toFixed(2))`
  - `nextPyramidPrice = newUnits < maxUnits && nAtEntry > 0 ? Number((fillPrice + 0.5 * nAtEntry).toFixed(2)) : null`
  - `unitFills = [...(Array.isArray(props.unit_fills) ? props.unit_fills : [oldEntry]), Number(fillPrice.toFixed(2))]`
- **Alternativa considerada:** Dejar que el usuario edite `entry_price` y `stop_loss` manualmente en un formulario genérico. Descartada porque introduce error humano en el promedio ponderado y en el trailing stop efectivo.

## Risks / Trade-offs

- **Trades reales `turtle` creados manualmente sin `selectedCandidate`:** No cuentan con `n_at_entry` ni `trailing_stop_10d` exactos del screener. → *Mitigación:* Inferir `n_at_entry` como `(entry_price - stop_loss) / 2` cuando `entry_price > stop_loss` y usar `stop_loss` como `trailing_stop_10d` base; mostrar aviso informativo en el modal si `n_at_entry` fue estimado.
- **Doble botón de acción en `Live Positions` para Tortugas (`[+ Unidad]` y `[Cerrar]`):** Puede ensanchar la columna `ACTION` en viewports medianos. → *Mitigación:* Renderizar ambos botones en un `flex items-center gap-1 whitespace-nowrap` con padding compacto (`px-1.5 py-1 text-[11px]`).
