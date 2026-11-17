# Tasks

## 1. Eliminación de `DashboardColumn` y Aplanado de Columnas (`Dashboard.tsx`)

- [x] 1.1 Eliminar `DashboardColumnProps` y el componente `DashboardColumn` (líneas 45–65) en `frontend/src/components/Dashboard/Dashboard.tsx`, verificando mediante búsqueda en `frontend/src/` que no queden referencias ni props huérfanas (`title`, `icon`) de nivel de columna.
- [x] 1.2 Reemplazar las 3 etiquetas `<DashboardColumn ...>` y sus `<div>` contenedores hijos intermedios en `frontend/src/components/Dashboard/Dashboard.tsx` por tres contenedores directos `<div className="flex flex-col gap-3 md:h-full md:min-h-0 md:overflow-hidden">`, verificando que los `WidgetPanel` internos conserven sus clases `md:shrink-0 md:max-h-[42%]`, `md:flex-1 md:min-h-0` y `flex-1 flex flex-col min-h-0`.

## 2. Verificación de Build e Integridad Flexbox

- [x] 2.1 Ejecutar `npm run build` en `frontend/` y verificar que Vite compile con código de salida `0` sin errores de sintaxis JSX ni de tipado TypeScript, manteniendo las utilidades `md:h-full`, `md:min-h-0` y `md:overflow-hidden` en el bundle CSS.
