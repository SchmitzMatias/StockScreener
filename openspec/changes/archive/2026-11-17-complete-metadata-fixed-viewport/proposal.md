# Proposal

## Why

La tabla `market_metadata` en Supabase carece de la columna `spy_history` (y `last_run`), lo que provoca que `persist_market_metadata` en `backend/data_loader.py` falle en el primer `upsert` con error `PGRST204`, ejecute el bloque `except` de respaldo y descarte silenciosamente el historial de precios del S&P 500, dejando el widget `SparkLine` de `Header.tsx` mostrando `"Sin historial"`. Adicionalmente, el layout actual del dashboard permite el crecimiento vertical sin límite (`min-h-full` en paneles apilados y falta de restricción de altura en escritorio), obligando a desplazar toda la página y perdiendo de vista los widgets macro superiores y los encabezados de las tablas.

## What Changes

- **Base de Datos y Backend (`market_metadata` & `data_loader.py`):**
  - Incorporar el script SQL idempotente `backend/patch_market_metadata.sql` para añadir `spy_history JSONB DEFAULT '[]'::jsonb` y `last_run TEXT` a `public.market_metadata`, y recargar la caché de esquema de PostgREST (`NOTIFY pgrst, 'reload schema';`).
  - Modificar `persist_market_metadata` en `backend/data_loader.py` para incluir `spy_history` directamente en `base_payload` junto a `vix_price`, `vix_change`, `sma20_bull_pct`, `spy_price` y `spy_change`, evitando que se descarte ante eventuales fallbacks de esquema.
- **Frontend (`Header.tsx` y limpieza):**
  - Añadir normalización defensiva de `spy_history` en `frontend/src/components/Header.tsx` (soportando array JSONB nativo o string JSON serializado) y activar `invertColors` en la `MetricCard` de Volatility Index (VIX) para que las subidas (`+`) se muestren en rojo (`text-danger`) y las caídas (`-`) en verde (`text-accent`).
  - Eliminar el archivo legacy obsoleto `frontend/src/services/dataClient.js` con remanentes de `fetch` local a JSON.
- **Frontend UX — Fixed Viewport Condicional (`md:` Desktop vs Mobile):**
  - En móvil (`< md`), preservar el flujo vertical natural con scroll completo de página para los widgets, el Top 5 y el formulario.
  - En escritorio (`md:` en adelante), fijar el layout a `md:h-screen md:overflow-hidden` en `App.tsx` y propagar `md:flex-1 md:min-h-0 md:overflow-hidden` por el grid de 3 columnas, `DashboardColumn` y `WidgetPanel` (eliminando `min-h-full`) para aislar el scroll dentro de cada tabla y del formulario en `TradeEntryForm.tsx`, manteniendo siempre visibles el `Header`, títulos de columna, sub-tabs y footers de KPIs (`shrink-0`).
  - En `DataTable.tsx`, añadir `min-h-0` al contenedor scrollable y `sticky top-0 bg-panel z-10` permanente en `<thead>` (tanto en móvil como en escritorio).

## Capabilities

### New Capabilities
*(Ninguna — se extienden capacidades existentes)*

### Modified Capabilities
- `persistence-pipeline`: Garantizar la persistencia del array `spy_history` (`JSONB`) en `public.market_metadata` sin descartes por fallback de esquema en `data_loader.py` y proveer el parche DDL idempotente para Supabase.
- `market-dashboard-view`: Incorporar hidratación robusta de `spy_history` y semántica visual invertida del VIX en `Header.tsx`, junto con el layout de viewport fijo condicional (`md:h-screen md:overflow-hidden`) con scroll interno por tabla y encabezados `sticky`.

## Impact

- **Nuevo archivo:** `backend/patch_market_metadata.sql`
- **Backend afectado:** `backend/data_loader.py` (`persist_market_metadata`), `backend/data_migration.py` (ejecución de `migrate_metadata` tras el parche SQL).
- **Frontend afectado:**
  - `frontend/src/App.tsx`
  - `frontend/src/components/Header.tsx`
  - `frontend/src/components/Dashboard/Dashboard.tsx`
  - `frontend/src/components/Dashboard/DataTable.tsx`
  - `frontend/src/components/Dashboard/TradeEntryForm.tsx`
  - Eliminación de `frontend/src/services/dataClient.js`
- **Base de datos (Supabase):** Adición de columnas `spy_history` (`JSONB`) y `last_run` (`TEXT`) en `public.market_metadata`.
