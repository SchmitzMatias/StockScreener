# Design

## Context

Ver `proposal.md` para la motivación del cambio. Al auditar `frontend/src/components/Dashboard/Dashboard.tsx`, no existe un archivo `DashboardColumn.tsx` independiente; `DashboardColumn` es un subcomponente interno definido en las líneas 45–65 de `Dashboard.tsx`:

- Envuelve cada una de las 3 columnas en un contenedor con `bg-panel border border-slate-800 rounded-lg p-2 md:h-full md:min-h-0 md:overflow-hidden`.
- Renderiza un encabezado `<div className='flex pb-3 items-center gap-2 shrink-0'>` con icono y `<h2>` (`"1. Screener Engine"`, `"2. Theoretical Performance"`, `"3. Real Portfolio"`).
- Inserta un `<div>` intermedio (`flex flex-col md:flex-1 md:min-h-0 md:overflow-hidden`), dentro del cual el JSX de `Dashboard` volvía a anidar otro `<div className='flex flex-col gap-3 md:flex-1 md:min-h-0 md:overflow-hidden'>` para alojar los `WidgetPanel` (que ya tienen su propio `bg-panel border border-slate-800 rounded-lg p-2`).

Esto genera doble borde, doble padding (`p-2` externo + `p-2` de cada `WidgetPanel`) y ~52px verticales ocupados por títulos redundantes en cada columna.

## Goals / Non-Goals

**Goals:**
- Eliminar por completo `DashboardColumnProps`, `DashboardColumn` y los 3 encabezados de nivel de columna en `frontend/src/components/Dashboard/Dashboard.tsx`.
- Reclamar ~52px de altura vertical útil por columna y eliminar el doble marco visual alrededor de los `WidgetPanel`.
- Aplanar dos niveles redundantes de `<div>` por columna manteniendo intacta la propagación `md:h-full md:min-h-0 md:overflow-hidden` hacia `WidgetPanel`, `DataTable` y `TradeEntryForm`.

**Non-Goals:**
- Modificar `WidgetPanel`, `DataTable.tsx`, `TradeEntryForm.tsx`, `Header.tsx` o `App.tsx`.
- Alterar el grid responsivo (`grid-cols-1 md:grid-cols-3 gap-3`) ni el comportamiento móvil (`< md`).

## Decisions

### 1. Eliminación completa de `DashboardColumn` y `DashboardColumnProps`
- **Decisión:** Borrar `DashboardColumnProps` y `DashboardColumn` de `frontend/src/components/Dashboard/Dashboard.tsx` (líneas 45–65) y reemplazar cada bloque `<DashboardColumn ...><div className='flex flex-col gap-3 md:flex-1 md:min-h-0 md:overflow-hidden'>...</div></DashboardColumn>` por un único contenedor directo de columna:
  ```tsx
  <div className="flex flex-col gap-3 md:h-full md:min-h-0 md:overflow-hidden">
      {/* WidgetPanels de la columna */}
  </div>
  ```
- **Alternativa descartada:** Conservar `DashboardColumn` sin props `title`/`icon` como un componente wrapper `<div className="...">{children}</div>`. Se descarta porque agregaría una capa de abstracción sin comportamiento ni markup propio y conservaría el borde exterior redundante (`bg-panel border border-slate-800`) y el doble nodo `<div>` por columna.

### 2. Verificación de la cadena Flexbox (`100vh` -> Grid -> Columna -> `WidgetPanel` -> `DataTable`)
- **Decisión:** Fusionar `md:h-full` (proveniente de `DashboardColumn`) con `flex flex-col gap-3 md:min-h-0 md:overflow-hidden` en cada hijo directo del CSS Grid (`grid-cols-1 md:grid-cols-3 gap-3 md:flex-1 md:min-h-0 md:overflow-hidden`):
  ```text
  Antes:
  div.grid (md:grid-cols-3 md:flex-1 md:min-h-0 md:overflow-hidden)
   └── DashboardColumn (bg-panel border p-2 md:h-full md:min-h-0 md:overflow-hidden)
        ├── div.header (pb-3 shrink-0)  <-- ~36px + p-2 (~16px) = ~52px perdidos
        └── div (flex flex-col md:flex-1 md:min-h-0 md:overflow-hidden)
             └── div (flex flex-col gap-3 md:flex-1 md:min-h-0 md:overflow-hidden)
                  └── WidgetPanel (bg-panel border p-2 md:min-h-0 md:overflow-hidden)

  Después:
  div.grid (md:grid-cols-3 md:flex-1 md:min-h-0 md:overflow-hidden)
   └── div (flex flex-col gap-3 md:h-full md:min-h-0 md:overflow-hidden)
        └── WidgetPanel (bg-panel border p-2 md:min-h-0 md:overflow-hidden)
  ```
  - **Columna 1:** `Today's top 5` conserva `md:shrink-0 md:max-h-[42%]` (ahora el 42% se calcula sobre la altura total sin descontar 52px de marco/título) y `Trading Journal` conserva `md:flex-1 md:min-h-0` con scroll interno en `TradeEntryForm`.
  - **Columna 2:** `Theoretical Trades` conserva `className="flex-1 flex flex-col min-h-0"`, manteniendo `shrink-0` en sub-tabs y footer KPIs y scroll en `DataTable`.
  - **Columna 3:** `Live Positions` y `Trade History` conservan `className="md:flex-1 md:min-h-0"` (50/50 de altura), manteniendo `shrink-0` en el footer KPIs reales y scroll independiente en cada `DataTable`.

## Risks / Trade-offs

- **[Riesgo: Pérdida de numeración secuencial explícita `1. / 2. / 3.` entre columnas]** → *Mitigación:* El flujo visual izquierda-a-derecha mantiene el orden lógico (`Today's top 5` + `Trading Journal` → `Theoretical Trades` → `Live Positions` + `Trade History`), y cada `WidgetPanel` conserva su título, subtítulo e icono descriptivo.
- **[Riesgo: Ruptura de `md:max-h-[42%]` o expansión vertical si faltara `md:h-full` o `md:min-h-0` en el contenedor directo de columna]** → *Mitigación:* Al unir explícitamente `flex flex-col gap-3 md:h-full md:min-h-0 md:overflow-hidden` en los 3 `<div>` hijos del grid, la restricción de altura de la Spec 1.5 queda intacta.
