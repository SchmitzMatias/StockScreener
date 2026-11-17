# Tasks

## 1. Parche de Esquema en Base de Datos y Backend Python (`market_metadata`)

- [x] 1.1 Crear el script `backend/patch_market_metadata.sql` con el comando idempotente `ALTER TABLE public.market_metadata ADD COLUMN IF NOT EXISTS spy_history JSONB DEFAULT '[]'::jsonb, ADD COLUMN IF NOT EXISTS last_run TEXT;` seguido de `NOTIFY pgrst, 'reload schema';`, y verificar que el archivo contiene ambas sentencias DDL y recarga de esquema.
- [x] 1.2 Actualizar `persist_market_metadata` en `backend/data_loader.py` para incluir `"spy_history": meta_data.get("spy_history", [])` directamente dentro de `base_payload` (manteniendo `last_run` y `updated_at` en `full_payload`) y verificar mediante prueba unitaria o script Python en seco que el payload retornado y el fallback contengan `spy_history` como lista serializable.
- [x] 1.3 Tras aplicar `backend/patch_market_metadata.sql` en el SQL Editor de Supabase, ejecutar `migrate_metadata()` de `backend/data_migration.py` (o una ejecución de `persist_market_metadata`) y verificar que el registro `id = 1` en `public.market_metadata` devuelva `spy_history` poblado y `last_run` sin error `PGRST204`.

## 2. Auditoría y Ajustes en Widgets Superiores (`Header.tsx`)

- [x] 2.1 Actualizar `frontend/src/components/Header.tsx` para normalizar defensivamente `spy_history` (soportando tanto array JSONB nativo como string JSON parseable), agregar `invertColors` a la `MetricCard` de Volatility Index (VIX) y añadir `shrink-0` al `<header>`, verificando en el render que el `SparkLine` muestre la serie de SPY y las subidas del VIX se muestren en rojo.
- [x] 2.2 Eliminar el archivo obsoleto `frontend/src/services/dataClient.js` y verificar mediante búsqueda en `frontend/src/` que no quede ningún remanente de `fetch` a JSON local (`meta.json`, `history.json` o `kotegawa_history.json`).

## 3. Refactor UX: Fixed Viewport Condicional (`md:`) y Scroll Interno

- [x] 3.1 Actualizar `frontend/src/App.tsx` cambiando `className='m-3'` por `className='min-h-screen md:h-screen md:overflow-hidden flex flex-col p-3 box-border'` y verificar que no exista desbordamiento por margen externo en escritorio (`md:`).
- [x] 3.2 Refactorizar `DashboardColumn` y `WidgetPanel` en `frontend/src/components/Dashboard/Dashboard.tsx` eliminando `min-h-full`, aplicando `md:h-full md:min-h-0 md:overflow-hidden` en `DashboardColumn` (con `shrink-0` en su título y `flex flex-col md:flex-1 md:min-h-0 md:overflow-hidden` en su contenedor hijo) y `md:min-h-0 md:overflow-hidden` en `WidgetPanel` (con `shrink-0` en su cabecera).
- [x] 3.3 Ajustar la raíz de `Dashboard`, el grid de 3 columnas (`md:grid-cols-3 md:flex-1 md:min-h-0 md:overflow-hidden`), los wrappers internos de las 3 columnas (`Today's top 5` con `md:shrink-0 md:max-h-[42%]`, `Trading Journal` y paneles de Columna 3 con `md:flex-1 md:min-h-0`, sub-tabs y footers de KPIs con `shrink-0`) en `frontend/src/components/Dashboard/Dashboard.tsx`, y añadir `md:flex-1 md:min-h-0 md:overflow-y-auto md:pr-1` a ambos `<form>` de `frontend/src/components/Dashboard/TradeEntryForm.tsx`, verificando que cada tabla y formulario scrollee de forma independiente en `md:`.
- [x] 3.4 Actualizar `frontend/src/components/Dashboard/DataTable.tsx` añadiendo `min-h-0` al contenedor con `overflow-y-auto` y `sticky top-0 bg-panel z-10` permanente en `<thead>`, verificando que los encabezados permanezcan fijos al hacer scroll vertical.

## 4. Verificación e Integración

- [x] 4.1 Ejecutar `npm run build` en `frontend/` y verificar que TypeScript (`tsc`) y Vite compilen con código de salida `0` sin errores de tipado ni referencias rotas.
- [x] 4.2 Verificar manualmente en navegador (`npm run dev`): en escritorio (`>= 768px`, ej. 1280x720 y 1920x1080) que la página no tenga scroll global y las listas scrolleen internamente con `<thead>` fijo, `SparkLine` de SPY renderizado y `Header` estático; y en móvil (`< 768px`, ej. 375x812) que la página fluya con scroll vertical natural.
