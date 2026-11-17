# Design

## Context

Ver `proposal.md` para la motivación general. Desde el punto de vista técnico existen dos problemas acoplados al estado actual:

1. **Pérdida silenciosa de `spy_history` por error `PGRST204` en `backend/data_loader.py`:**
   - En `persist_market_metadata` (`backend/data_loader.py` líneas 421–458), `base_payload` solo incluye `id`, `vix_price`, `vix_change`, `sma20_bull_pct`, `spy_price` y `spy_change`, mientras que `last_run` y `spy_history` se añaden únicamente en `full_payload`.
   - Dado que la tabla `public.market_metadata` en Supabase no posee la columna `spy_history` (y puede carecer de `last_run` si solo usa `updated_at`), PostgREST devuelve `PGRST204`. El bloque `except` captura el error y ejecuta un `upsert(fallback_payload)` basado en `base_payload`, descartando `spy_history` por completo.
   - Adicionalmente, en `Header.tsx`, la lectura ya apunta a `supabase.from('market_metadata').select('*')`, pero falta blindar la normalización si `spy_history` llegara serializado como texto JSON, falta pasar `invertColors` en la `MetricCard` del VIX, y permanece un módulo huérfano (`frontend/src/services/dataClient.js`) con `fetch` local.

2. **Seis rupturas en la cadena de restricción de altura (`height` / `min-h-0`) en React/Tailwind:**
   - `App.tsx` usa `m-3` sin altura acotada ni `flex-col`.
   - `Header.tsx` no declara `shrink-0`.
   - El contenedor raíz y el grid de 3 columnas en `Dashboard.tsx` (`sm:grid-cols-3`) no reciben `flex-1 min-h-0`.
   - `DashboardColumn` tiene `min-h-full` en su raíz y envuelve `{children}` en un `<div>` sin clases Flexbox que corta la propagación de altura.
   - `WidgetPanel` declara `min-h-full` en su clase base, forzando a que los paneles apilados en las Columnas 1 y 3 midan al menos `100% + 100%` de la columna.
   - `DataTable.tsx` carece de `min-h-0` en su contenedor `overflow-y-auto` y de `sticky top-0 bg-panel z-10` en el `<thead>`.

## Goals / Non-Goals

**Goals:**
- Garantizar la existencia de las columnas `spy_history` (`JSONB`) y `last_run` (`TEXT`) en `public.market_metadata` y la persistencia incondicional de `spy_history` desde `backend/data_loader.py`.
- Asegurar que el SparkLine del S&P 500 y la tarjeta de VIX en `Header.tsx` rendericen correctamente los datos de Supabase sin remanentes de `fetch` local.
- Lograr un layout de altura fija (`100vh`) exclusivamente en escritorio (`md:` y superior) con scroll interno aislado dentro de tablas y del formulario, manteniendo estáticos el `Header`, títulos, sub-tabs y footers de KPIs, y conservando el scroll natural de página completa en móvil (`< md`).

**Non-Goals:**
- Rediseñar los componentes en tarjetas separadas (`SPYWidget.tsx`, `VIXWidget.tsx`, etc.); se mantiene la arquitectura actual unificada en `Header.tsx` con `MetricCard`.
- Modificar el cálculo matemático de `get_spy_metrics()` ni el algoritmo del screener.
- Introducir scroll interno forzado o contenedores de altura fija en resoluciones móviles (`< 768px`).

## Decisions

### 1. Esquema SQL para `public.market_metadata` (`JSONB` sobre `NUMERIC[]`)
- **Decisión:** Utilizar `JSONB DEFAULT '[]'::jsonb` para `spy_history` junto con `last_run TEXT` y forzar la recarga del schema cache de PostgREST:
  ```sql
  -- 1. Agregar columna spy_history (JSONB) y asegurar last_run en market_metadata
  ALTER TABLE public.market_metadata
      ADD COLUMN IF NOT EXISTS spy_history JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS last_run TEXT;

  -- 2. Forzar recarga inmediata del schema cache de PostgREST (evita error PGRST204)
  NOTIFY pgrst, 'reload schema';
  ```
- **Alternativa descartada:** Usar `NUMERIC[]` de PostgreSQL. Se descarta porque `JSONB` se alinea con la arquitectura extensible del proyecto (`openspec/project.md`), se serializa directamente desde listas nativas de Python mediante `supabase-py` sin conversión de sintaxis de arrays Postgres, y soporta evolución futura (p. ej. objetos `{ date, close }`) sin migraciones destructivas.

### 2. Inyección de `spy_history` en `base_payload` (`backend/data_loader.py`)
- **Decisión:** En `persist_market_metadata` (`backend/data_loader.py` líneas 429–455), mover `"spy_history": meta_data.get("spy_history", [])` dentro de `base_payload` junto a `vix_price`, `vix_change`, `sma20_bull_pct`, `spy_price` y `spy_change`. En `full_payload`, mantener `**base_payload`, `"last_run": meta_data.get("last_run")` y `"updated_at": datetime.now().isoformat()`. Si el `except` de fallback por `last_run`/`updated_at` llegara a ejecutarse en otro entorno, `spy_history` seguirá estando incluido en `fallback_payload` y nunca se perderá.
- **Alternativa descartada:** Eliminar por completo el `try/except` asumiendo que `last_run` siempre existe. Se descarta para conservar resiliencia ante entornos que solo cuenten con `updated_at`, pero asegurando que `spy_history` no sea excluido en el fallback.

### 3. Estrategia de Clases Tailwind para Fixed-Viewport Condicional (`md:`)
- **Decisión:** Aplicar las restricciones de altura y desbordamiento con el prefijo responsivo `md:` (`>= 768px`) desde la raíz hasta los contenedores de tablas, manteniendo los encabezados `<thead>` sticky en todas las resoluciones:
  - **`frontend/src/App.tsx`:** Reemplazar `m-3` por `min-h-screen md:h-screen md:overflow-hidden flex flex-col p-3 box-border`. Usar `p-3` con `box-border` evita que el margen externo sume `24px` adicionales a `100vh`.
  - **`frontend/src/components/Header.tsx`:** Añadir `shrink-0` al `<header>` (`grid grid-cols-3 lg:grid-cols-5 gap-3 mb-3 shrink-0`) para evitar compresión vertical en escritorio. Normalizar `spy_history` aceptando `Array` o string JSON parseable, y pasar `invertColors` a la `MetricCard` del VIX.
  - **`frontend/src/components/Dashboard/Dashboard.tsx`:**
    - Raíz de `Dashboard`: `flex flex-col gap-3 md:flex-1 md:min-h-0 md:overflow-hidden`.
    - Grid principal de 3 columnas: `grid grid-cols-1 md:grid-cols-3 gap-3 md:flex-1 md:min-h-0 md:overflow-hidden` (se alinea el quiebre de 3 columnas a `md:grid-cols-3` en lugar de `sm:grid-cols-3` para que coincida exactamente con el corte `md:` del viewport fijo).
    - `DashboardColumn`: raíz `flex flex-col bg-panel border border-slate-800 rounded-lg p-2 md:h-full md:min-h-0 md:overflow-hidden`, título con `shrink-0`, y wrapper de `{children}` con `flex flex-col md:flex-1 md:min-h-0 md:overflow-hidden`.
    - `WidgetPanel`: eliminar `min-h-full` de la clase base y usar `flex flex-col bg-panel border border-slate-800 rounded-lg p-2 md:min-h-0 md:overflow-hidden ${className}`, con header `shrink-0` y body `flex-1 min-h-0 flex flex-col md:overflow-hidden`.
    - Reparto interno por columna en `md:`:
      - **Columna 1 (`1. Screener Engine`):** wrapper `flex flex-col gap-3 md:flex-1 md:min-h-0 md:overflow-hidden`; `Today's top 5` con `className="md:shrink-0 md:max-h-[42%]"` (permite scrollear si hay >5 candidatos o pantalla baja sin aplastar el formulario); `Trading Journal` con `className="md:flex-1 md:min-h-0"`.
      - **Columna 2 (`2. Theoretical Performance`):** wrapper `flex flex-col gap-3 md:flex-1 md:min-h-0 md:overflow-hidden`; `Theoretical Trades` con `className="flex-1 flex flex-col min-h-0"`; sub-tabs (`Cerrados` / `Abiertos`) y footer de KPIs con `shrink-0`.
      - **Columna 3 (`3. Real Portfolio`):** wrapper `flex flex-col gap-3 md:flex-1 md:min-h-0 md:overflow-hidden`; `Live Positions` y `Trade History` con `className="md:flex-1 md:min-h-0"` cada uno (reparto 50/50); footer de KPIs reales con `shrink-0`.
  - **`frontend/src/components/Dashboard/TradeEntryForm.tsx`:** Añadir `md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1` tanto al `<form>` de login como al `<form>` de carga de trades para que el formulario tenga scroll interno en pantallas de escritorio con poca altura vertical (ej. 768p/720p).
  - **`frontend/src/components/Dashboard/DataTable.tsx`:** Añadir `min-h-0` al contenedor scrollable (`w-full overflow-x-auto flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent`) y `sticky top-0 bg-panel z-10` permanente en `<thead>` para fijar los títulos de columnas al scrollear.
- **Alternativa descartada:** Aplicar `h-screen overflow-hidden` desde `sm:` o sin breakpoint. Se descarta por solicitud explícita de UX para no atrapar al usuario móvil (`< md`) en micro-áreas con scroll anidado.

## Risks / Trade-offs

- **[Riesgo: Error `PGRST204` si el código backend se despliega antes de correr el SQL en Supabase]** → *Mitigación:* Ejecutar primero `backend/patch_market_metadata.sql` en el SQL Editor de Supabase (incluyendo `NOTIFY pgrst, 'reload schema';`) y validar con `migrate_metadata()` antes de ejecutar el pipeline diario.
- **[Riesgo: Pantallas de escritorio con altura reducida (ej. laptops 1366x768) donde `Header` + `Today's top 5` dejen poco alto a `Trading Journal`]** → *Mitigación:* Limitar `Today's top 5` con `md:max-h-[42%]` y dotar de `md:overflow-y-auto` al formulario de `TradeEntryForm.tsx`, asegurando que ningún botón de envío quede inaccesible fuera del viewport.
- **[Riesgo: Cambio de grid de 3 columnas de `sm:` (640px) a `md:` (768px)]** → *Mitigación:* Entre 640px y 767px (tablets estrechas en vertical), apilar en 1 columna evita tablas comprimidas horizontalmente y mantiene consistencia exacta con el inicio del viewport fijo en `md:`.

## Migration Plan

1. Ejecutar `backend/patch_market_metadata.sql` en el SQL Editor del proyecto Supabase.
2. Actualizar `backend/data_loader.py` y ejecutar `python backend/data_migration.py` (o `migrate_metadata()`) para poblar `spy_history` en `market_metadata` (`id = 1`) desde `data/meta.json` sin esperar al cierre de mercado.
3. Aplicar los cambios en `frontend/src/`, eliminar `frontend/src/services/dataClient.js` y validar compilación con `npm run build`.
4. **Rollback:** Los cambios CSS/TSX y el payload Python son completamente reversibles con `git revert`; las columnas añadidas en `market_metadata` (`spy_history`, `last_run`) tienen valores por defecto y no rompen lecturas anteriores.
