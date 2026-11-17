# Proposal

## Why

Los encabezados generales de las 3 columnas principales en `frontend/src/components/Dashboard/Dashboard.tsx` (`"1. Screener Engine"`, `"2. Theoretical Performance"`, `"3. Real Portfolio"`) duplican el contexto que ya proporcionan los paneles internos (`"Today's top 5"`, `"Trading Journal"`, `"Theoretical Trades"`, `"Live Positions"`, `"Trade History"`) y consumen ~52px de altura vertical por columna (`p-2` del wrapper externo + `pb-3` + `h2`). Eliminar el componente `DashboardColumn` reclama ese espacio vertical crítico para resoluciones de laptop (`1366x768`) dentro del layout fijo `md:h-screen` y aplana dos niveles innecesarios del árbol DOM junto con su doble borde exterior.

## What Changes

- Eliminar la interfaz `DashboardColumnProps` y el componente interno `DashboardColumn` de `frontend/src/components/Dashboard/Dashboard.tsx` (líneas 45–65).
- Reemplazar las 3 invocaciones `<DashboardColumn title="..." icon="...">` y sus `<div>` contenedores hijos intermedios en `frontend/src/components/Dashboard/Dashboard.tsx` por un único contenedor `<div className="flex flex-col gap-3 md:h-full md:min-h-0 md:overflow-hidden">` por columna dentro del grid principal.
- Preservar intacta la cadena de restricción de altura Flexbox (`md:flex-1 md:min-h-0 md:overflow-hidden`) hacia cada `WidgetPanel`, `DataTable` y `TradeEntryForm`.

## Capabilities

### New Capabilities
*(Ninguna)*

### Modified Capabilities
- `market-dashboard-view`: Eliminar los encabezados redundantes de nivel de columna y aplanar los contenedores de las 3 columnas del dashboard conservando el contrato de viewport fijo (`md:h-screen`) y scroll interno de la Spec 1.5.

## Impact

- **Frontend afectado:** `frontend/src/components/Dashboard/Dashboard.tsx`
- **Compatibilidad:** Sin impacto en backend ni consultas Supabase; mantiene intactos los `WidgetPanel`, sub-tabs, footers de KPIs, `DataTable` y `TradeEntryForm`.
