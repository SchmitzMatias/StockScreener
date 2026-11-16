# Proposal

## Why

El sistema Kotegawa persiste sus datos de escaneo diario, estado macro del mercado y registro de backtest en archivos estáticos JSON (`meta.json`, `history.json`, `backtest.json`, `portfolio.json`). Esto obliga al frontend a importar los archivos en tiempo de compilación (Vite bundle), impidiendo actualizaciones en tiempo real, bloqueando la orquestación multi-estrategia e imposibilitando la bitácora de trading manual en producción. Migrar a Supabase (PostgreSQL) desacopla la escritura automatizada del pipeline de Python del consumo visual de React, garantizando persistencia relacional, normalización pura y consultas en vivo.

## What Changes

- **Backend (Pipeline Cuantitativo):**
  - **BREAKING:** Reemplazo total de la lectura y escritura a archivos locales en disco (`data/*.json`) en `data_loader.py` por operaciones a Supabase (`market_metadata`, `screener_candidates`, `trades`).
  - Unificación del cálculo de Target en `scoring_engine.py` bajo la regla de RRR 1:0.85 (`close_price + (riesgo * 0.85)`), eliminando el recálculo discrepante en `data_loader.py` (principio DRY).
  - Sanitización de datos antes del volcado a la BBDD (conversión estricta de `NaN`, `Inf` y tipos NumPy a `None/null` estándar).
  - Gestión segura de credenciales maestras (`SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL`) mediante variables de entorno en `.env` (sin secretos hardcodeados en código).
  - Actualización de dependencias en `backend/requirements.txt` (`supabase`, `python-dotenv`).

- **Frontend (Cliente React/Vite):**
  - **BREAKING:** Eliminación de los `import` estáticos de `data/*.json` en `Header.tsx` y `Dashboard.tsx`.
  - Creación del cliente singleton de Supabase en `frontend/src/lib/supabase.ts` consumiendo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
  - Implementación de hooks/estados asíncronos (`isLoading`, `error`, datos en estado de React) con guardas defensivas para prevenir caídas por renders incompletos.
  - Adaptación de interfaces de datos y `accessorKey` en `DashboardTables.tsx` a la convención `snake_case` nativa de la base de datos relacional.
  - El frontend se mantiene estrictamente como visor de **SOLO LECTURA** para el screener, las métricas macro y los trades teóricos (`taken = false`), y visualizador pasivo para trades reales (`taken = true`).
  - Incorporación de `@supabase/supabase-js` en `frontend/package.json`.

## Capabilities

### New Capabilities
- `persistence-pipeline`: Gestión de la persistencia relacional de metadatos macro (`market_metadata`), candidatos calificados del screener (`screener_candidates`) y ciclo de vida de trades teóricos (`trades` con `taken = false`) mediante el pipeline automatizado de Python.
- `market-dashboard-view`: Consulta asíncrona y visualización reactiva de solo lectura en el frontend de métricas macro, candidatos diarios y bitácora de posiciones teóricas y reales persistidas en Supabase.

### Modified Capabilities
*(Ninguna - primera especificación formal del proyecto)*

## Impact

- **Código Afectado:**
  - `backend/data_loader.py`
  - `backend/scoring_engine.py`
  - `backend/data_migration.py`
  - `backend/requirements.txt`
  - `frontend/package.json`
  - `frontend/src/components/Header.tsx`
  - `frontend/src/components/Dashboard/Dashboard.tsx`
  - `frontend/src/components/Dashboard/DashboardTables.tsx`
  - Nuevo archivo: `frontend/src/lib/supabase.ts`
- **APIs y BBDD:** Conexión directa a Supabase PostgreSQL vía PostgREST SDKs (`supabase-py` y `@supabase/supabase-js`).
- **Seguridad:** Eliminación de claves secretas expuestas en scripts locales y adopción de políticas de acceso diferenciado (Service Role para Python, Anon Key para React con RLS).

