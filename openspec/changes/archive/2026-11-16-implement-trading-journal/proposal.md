# Proposal

## Why

Con la persistencia en Supabase ya operativa en modo lectura (Spec 1), el panel de *Trading Journal* (`TradeEntryForm.tsx`) permanece desconectado (`window.alert` mock), impidiendo registrar operaciones reales ejecutadas en el broker (`taken = true`) y gestionar su cierre manual. Implementar el flujo completo de alta, *Quick-Add* desde candidatos del screener y liquidación manual —protegido mediante autenticación de operador único con Supabase Auth y políticas RLS estrictas— permite auditar el rendimiento real del portafolio frente al *edge* teórico del algoritmo sin exponer la base de datos a escrituras anónimas ni contaminar el backtest.

## What Changes

- **Seguridad y Autenticación (Supabase Auth + RLS):**
  - Incorporación de autenticación de Operador Único mediante Supabase Auth (`signInWithPassword` / `signOut` y escucha de sesión con `onAuthStateChange`) en el frontend React.
  - Si el usuario no está autenticado (`anon`), el dashboard mantiene lectura pública total, pero el panel `Trading Journal` renderiza un formulario de login de operador y las acciones de escritura (`+ Tomar`, `Cerrar`) permanecen ocultas/deshabilitadas.
  - Definición de políticas RLS en `public.trades` (documentadas en script SQL de migración/configuración): `SELECT` público, e `INSERT` / `UPDATE` restringidos exclusivamente al rol `authenticated` forzando `WITH CHECK (taken = true)` y `USING (taken = true)`.
- **Apertura de Trades Reales y Quick-Add (`TradeEntryForm.tsx` + `DashboardTables.tsx`):**
  - Adición de columna de acción en la tabla `Today's top 5` (`DashboardTables.tsx`) con botón de *Quick-Add* (`+ Tomar`) que transfiere los datos del candidato seleccionado al `TradeEntryForm` embebido en la Columna 1.
  - Refactorización de `TradeEntryForm.tsx` para permitir ingreso de `ticker` (seleccionado por *Quick-Add* o escrito manualmente), `entry_date` (default hoy), `entry_price` (precio real ejecutado en broker), `target`, `stop_loss` y `notes` (almacenadas en `strategy_props.notes`).
  - Cumplimiento estricto de la **Invariante #4 (Agnosticismo Financiero del Frontend)**: al usar *Quick-Add*, `target` y `stop_loss` copian exactamente los valores sugeridos por el screener como valores por defecto editables, sin recalcular fórmulas matemáticas si el usuario modifica el `entry_price`.
  - Inserción en `public.trades` con `taken = true`, `status = 'OPEN'` y `strategy_props: { notes }`.
- **Cierre Manual de Posiciones Abiertas (`CloseTradeModal.tsx`):**
  - Nuevo componente modal ligero `CloseTradeModal.tsx` invocado desde un botón `Cerrar` en cada fila de la tabla `Live Positions` (Columna 3).
  - Solicita `exit_price`, `exit_date` (default hoy), `exit_reason` (`TP`, `SL`, `MANUAL`, `TIME_STOP`) y notas opcionales de salida (`strategy_props.exit_notes`).
  - Ejecuta `UPDATE` en `public.trades` pasando `status = 'CLOSED'`, `exit_price`, `exit_date`, `exit_reason`, `pnl_percent` y `days_held` (solo sobre `id` con `taken = true`).
- **Visualización de Estado y Sub-tabs en Backtest / Portafolio Real (`Dashboard.tsx`):**
  - Adición de sub-tabs en el panel `Theoretical Trades` (Columna 2) para alternar entre trades teóricos `Cerrados` (`status = 'CLOSED'`) y `Abiertos` (`status = 'OPEN'`).
  - Adición de un footer de KPIs reales en la Columna 3 (`Real Portfolio`) con `Win Rate`, `Cumulative PnL` y `Avg Days Held` de las operaciones reales cerradas, homólogo al de la Columna 2.

## Capabilities

### New Capabilities
- `trading-journal`: Flujo de autenticación de operador único, registro manual y vía *Quick-Add* de operaciones reales (`taken = true`, `status = 'OPEN'`), cierre manual mediante modal (`status = 'CLOSED'`) y resguardo por políticas RLS en Supabase.

### Modified Capabilities
- `market-dashboard-view`: Incorporación de sub-tabs de filtrado (`CLOSED` vs `OPEN`) en la vista de trades teóricos, botones de acción condicionales a la sesión en tablas de candidatos y posiciones vivas, y barra de KPIs de rendimiento en el portafolio real.

## Impact

- **Código Afectado:**
  - `frontend/src/components/Dashboard/Dashboard.tsx`
  - `frontend/src/components/Dashboard/DashboardTables.tsx`
  - `frontend/src/components/Dashboard/TradeEntryForm.tsx`
  - Nuevo archivo: `frontend/src/components/Dashboard/CloseTradeModal.tsx`
  - Nuevo archivo SQL de referencia RLS: `backend/supabase_rls_policies.sql`
- **Base de Datos y Seguridad:** Políticas RLS sobre `public.trades` en Supabase y uso de Supabase Auth (Email/Password con registro público deshabilitado).
