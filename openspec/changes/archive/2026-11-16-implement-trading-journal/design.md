# Design

## Context

En la Spec 1 (`migrate-persistence-supabase`) se conectó el frontend React/Vite a Supabase en modo de solo lectura utilizando `VITE_SUPABASE_ANON_KEY`. Actualmente, `Dashboard.tsx` descarga `screener_candidates` y `trades`, separando en cliente los registros teóricos (`taken = false`) de los reales (`taken = true`). Sin embargo, `TradeEntryForm.tsx` sigue siendo un mockup estático y no existe interfaz para cerrar posiciones abiertas en `Live Positions` ni protección de escritura.

Dado que el frontend se publica en GitHub Pages, la `anon_key` es pública. Por tanto, habilitar escrituras directas desde React exige combinar autenticación de usuario en Supabase Auth con políticas *Row Level Security* (RLS) que impidan escrituras anónimas y blinden los registros del bot (`taken = false`).

## Goals / Non-Goals

**Goals:**
- Habilitar autenticación de Operador Único con Supabase Auth (Email/Password) integrada dentro del panel `Trading Journal` sin bloquear la vista pública de solo lectura.
- Permitir el alta de trades reales (`taken = true`, `status = 'OPEN'`) desde `TradeEntryForm.tsx` (embebido en Columna 1), soportando tanto carga manual como *Quick-Add* desde la tabla `Today's top 5`.
- Mantener agnosticismo financiero absoluto en el frontend (Invariante #4): el *Quick-Add* copia `target` y `stop_loss` del candidato como valores iniciales editables, sin recalcularlos cuando el usuario ajusta `entry_price`.
- Proveer un modal ligero (`CloseTradeModal.tsx`) para cerrar posiciones reales abiertas (`status = 'CLOSED'`) registrando `exit_price`, `exit_date`, `exit_reason`, `pnl_percent` y `days_held`.
- Añadir sub-tabs (`Cerrados` / `Abiertos`) en el panel `Theoretical Trades` (Columna 2) y un footer de KPIs reales en la Columna 3.
- Documentar y proveer el script SQL idempotente con las políticas RLS para `public.trades`.

**Non-Goals:**
- Registro público de múltiples usuarios o multi-tenancy (el sistema es de Operador Único con *Allow new users to sign up* desactivado en Supabase).
- Recálculo automático de Stop Loss, ATR o relación Riesgo/Beneficio en el cliente web.
- Cierre automático de trades reales (`taken = true`) desde el cronjob de Python (`data_loader.py` mantiene `.eq("taken", False)`).

## Decisions

### 1. Flujo de Autenticación de Operador Único (Supabase Auth + RLS)
- **Decisión:** Utilizar `supabase.auth.getSession()`, `supabase.auth.onAuthStateChange()`, `supabase.auth.signInWithPassword({ email, password })` y `supabase.auth.signOut()`. Si `session === null`, el panel `Trading Journal` muestra un formulario compacto de Login de Operador y las tablas ocultan los botones de acción (`+ Tomar` y `Cerrar`). En PostgreSQL, las políticas RLS sobre `public.trades` exigen `TO authenticated` y fuerzan `taken = true` tanto en `INSERT` (`WITH CHECK (taken = true)`) como en `UPDATE` (`USING (taken = true) WITH CHECK (taken = true)`).
- **Alternativa descartada:** Proteger el formulario solo con un PIN en variables de entorno del frontend (`VITE_ADMIN_PIN`) manteniendo políticas RLS abiertas al rol `anon` (descartado porque el bundle de Vite expone todas las variables `VITE_*` y cualquiera podría insertar en Supabase vía REST).

### 2. Ubicación Híbrida de Formularios: Embebido para Apertura, Modal para Cierre
- **Decisión:**
  - **Apertura (`INSERT`):** Mantener `TradeEntryForm.tsx` embebido en la Columna 1 debajo de `Today's top 5`. Al pulsar `+ Tomar` en un candidato, el estado `selectedCandidate` en `Dashboard.tsx` pasa al formulario, pre-llenando los inputs (`ticker`, `entry_price`, `target`, `stop_loss`) y haciendo foco en `entry_price`.
  - **Cierre (`UPDATE`):** Crear `CloseTradeModal.tsx` renderizado condicionalmente cuando `closingTrade !== null` en `Dashboard.tsx`. Evita sobrecargar el ancho estrecho de la tabla `Live Positions` en la Columna 3.
- **Alternativa descartada:** Usar edición inline dentro de las filas de `Live Positions` (descartado porque rompe el layout de 3 columnas en pantallas medianas).

### 3. Invariante #4 en Quick-Add: Copia Literal sin Recálculo de SL/TP
- **Decisión:** Cuando `selectedCandidate` cambia, un `useEffect` en `TradeEntryForm.tsx` copia literalmente `candidate.ticker`, `candidate.close_price` (como sugerencia inicial en `entry_price`), `candidate.target` y `candidate.stop_loss`. Si el operador modifica `entry_price` para reflejar el precio real ejecutado en su broker, los estados `target` y `stop_loss` **no se recalculan automáticamente**; quedan como inputs numéricos editables manualmente por el trader.
- **Alternativa descartada:** Recalcular `target = entry_price + (entry_price - stop_loss) * 0.85` en React al cambiar `entry_price` (descartado por violar directamente la Invariante #4 de Agnosticismo Financiero del Frontend).

### 4. Factorías de Columnas en `DashboardTables.tsx`
- **Decisión:** Mantener `top5Columns` y `livePositionsColumns` como exportaciones por compatibilidad, y añadir funciones factoría `getTop5Columns(onQuickAdd?: (candidate: Top5Candidate) => void)` y `getLivePositionsColumns(onCloseTrade?: (position: LivePosition) => void)` que inyectan la columna de acción únicamente cuando el callback está presente (es decir, cuando el operador tiene sesión activa).
- **Alternativa descartada:** Acoplar la lógica de Supabase Auth o modales directamente dentro de `DataTable.tsx` (descartado para mantener `DataTable` como un componente de presentación puro y genérico).

### 5. Cálculo de `pnl_percent` y `days_held` al Cerrar Trade Real
- **Decisión:** Al confirmar `CloseTradeModal.tsx`, calcular la variación porcentual simple de liquidación `((exit_price - entry_price) / entry_price) * 100` (redondeada a 2 decimales) y la diferencia en días corridos `Math.max(0, Math.round((exitDate - entryDate) / 86400000))` para poblar las columnas universales `pnl_percent` y `days_held` de `public.trades`. En el footer de KPIs reales, un trade cerrado se considera ganador cuando `Number(pnl_percent) > 0` (dado que un cierre manual puede tener `exit_reason = 'MANUAL'` con ganancia positiva).

## Risks / Trade-offs

- **[Riesgo: Candidato fuera del Top 5 del día]** → *Mitigación:* Reemplazar el `<select>` cerrado de `TradeEntryForm.tsx` por un `<input type="text" list="available-tickers" />` acompañado de un `<datalist>`, permitiendo tanto elegir del Top 5 como escribir manualmente cualquier ticker (normalizado con `.trim().toUpperCase()`).
- **[Riesgo: Pérdida de notas de entrada al cerrar el trade]** → *Mitigación:* Al hacer `UPDATE` en `CloseTradeModal.tsx`, preservar el objeto `closingTrade.strategy_props` existente haciendo merge (`{ ...(closingTrade.strategy_props || {}), exit_notes }`) para no sobrescribir `notes` de apertura.
- **[Riesgo: Error de permisos RLS si no se aplicaron las políticas en Supabase]** → *Mitigación:* Proveer el archivo `backend/supabase_rls_policies.sql` listo para pegar en el SQL Editor de Supabase y mostrar mensajes de error descriptivos en la UI si Supabase devuelve un error `42501` (violación de RLS).
