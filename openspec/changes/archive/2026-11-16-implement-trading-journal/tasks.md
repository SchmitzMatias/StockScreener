# Tasks

## 1. Políticas de Seguridad RLS en Supabase

- [x] 1.1 Crear el archivo `backend/supabase_rls_policies.sql` con las sentencias SQL idempotentes para habilitar RLS en `public.trades`, permitir `SELECT` público (`anon`, `authenticated`), y restringir `INSERT` y `UPDATE` exclusivamente a `authenticated` forzando `taken = true` (`USING (taken = true)` y `WITH CHECK (taken = true)`).

## 2. Definición de Columnas Interactivas y Sub-tabs (`DashboardTables.tsx`)

- [x] 2.1 Actualizar `frontend/src/components/Dashboard/DashboardTables.tsx` añadiendo la factoría `getTop5Columns(onQuickAdd?: (candidate: Top5Candidate) => void)` que agregue la columna de acción con el botón `+ Tomar` cuando el operador esté autenticado.
- [x] 2.2 Añadir en `frontend/src/components/Dashboard/DashboardTables.tsx` la factoría `getLivePositionsColumns(onCloseTrade?: (position: LivePosition) => void)` que incluya `entry_date` y agregue la columna de acción con el botón `Cerrar` cuando el operador esté autenticado.

## 3. Formulario Embebido de Apertura y Login de Operador (`TradeEntryForm.tsx`)

- [x] 3.1 Refactorizar `frontend/src/components/Dashboard/TradeEntryForm.tsx` para recibir la sesión de Supabase (o estado `isAuthenticated`), `selectedCandidate: Top5Candidate | null`, `availableTickers: string[]` y el callback `onTradeCreated: () => void`.
- [x] 3.2 Implementar en `TradeEntryForm.tsx` la vista de Login de Operador (`email`, `password` vía `supabase.auth.signInWithPassword`) cuando no exista sesión activa, y un botón de `Cerrar sesión` (`supabase.auth.signOut`) cuando esté autenticado.
- [x] 3.3 Implementar en `TradeEntryForm.tsx` los campos controlados del trade (`ticker` con `<datalist>`, `entry_date` por defecto hoy, `entry_price`, `target`, `stop_loss`, y `notes`), pre-llenando literalmente desde `selectedCandidate` sin recalcular `target` ni `stop_loss` si el usuario edita `entry_price` (Invariante #4).
- [x] 3.4 Conectar el `onSubmit` de `TradeEntryForm.tsx` con `supabase.from('trades').insert(...)` enviando `taken: true`, `status: 'OPEN'`, `strategy: selectedCandidate?.strategy || 'kotegawa'` y `strategy_props: { notes }`, manejando estados de carga/error y disparando `onTradeCreated()`.

## 4. Modal de Cierre Manual (`CloseTradeModal.tsx`)

- [x] 4.1 Crear el componente `frontend/src/components/Dashboard/CloseTradeModal.tsx` que reciba la posición activa (`trade: LivePosition`), `onClose: () => void` y `onTradeClosed: () => void`.
- [x] 4.2 Implementar en `CloseTradeModal.tsx` el formulario con `exit_price` (requerido), `exit_date` (default hoy), selector `exit_reason` (`TP`, `SL`, `MANUAL`, `TIME_STOP`) y `exit_notes` opcional.
- [x] 4.3 Ejecutar en `CloseTradeModal.tsx` la actualización en Supabase (`supabase.from('trades').update(...).eq('id', trade.id).eq('taken', true)`) calculando `pnl_percent`, `days_held` y preservando `strategy_props` previas junto con `exit_notes`.

## 5. Orquestación en Dashboard, Sub-tabs y KPIs Reales (`Dashboard.tsx`)

- [x] 5.1 Actualizar `frontend/src/components/Dashboard/Dashboard.tsx` para gestionar el estado de sesión de Supabase (`supabase.auth.getSession` y `onAuthStateChange`), `selectedCandidate`, `closingTrade` y exponer `fetchDashboardData` mediante `useCallback`.
- [x] 5.2 Añadir en el panel `Theoretical Trades` (Columna 2 de `Dashboard.tsx`) sub-tabs para alternar entre trades teóricos `Cerrados` (`status = 'CLOSED'`) y `Abiertos` (`status = 'OPEN'`).
- [x] 5.3 Añadir en el panel `Trade History` (Columna 3 de `Dashboard.tsx`) el footer de KPIs del portafolio real (`Win Rate`, `Cumulative PNL`, `Closed Trades`, `Avg Days Held`) y conectar `CloseTradeModal`.
- [x] 5.4 Ejecutar `npm run build` en `frontend/` para verificar que TypeScript y Vite compilan limpiamente sin errores de tipos.
