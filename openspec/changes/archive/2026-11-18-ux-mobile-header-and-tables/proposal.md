# Proposal

## Why

En dispositivos móviles (`< md`), el `Header` actual fuerza 4 tarjetas visibles dentro de un grid de 3 columnas (`grid-cols-3`), provocando compresión y desborde horizontal en Card 1 (Logo + Selector de estrategia) y Card 4 (SMA20), además de dejar la tarjeta de última ejecución (`Cronjob`) huérfana en una segunda fila. Simultáneamente, las tablas del `Dashboard` (`Theoretical Trades` y `Trade History`) carecen de límite de altura en `< md`, expandiendo el DOM verticalmente y generando un scroll de página excesivo que dificulta navegar entre widgets.

## What Changes

- Reestructurar el grid del `Header` para pantallas menores a `md` (`grid-cols-2 md:grid-cols-4 lg:grid-cols-5`), haciendo que la tarjeta de Logo + Selector de estrategia ocupe la fila superior completa (`col-span-2 md:col-span-1`) y que VIX y Cronjob compartan de forma balanceada la segunda fila.
- Ocultar la tarjeta de "Bullish participation" (`SMA20`) en pantallas menores a `md` (`hidden md:flex`), manteniéndola visible desde `md` (`>= 768px`) en adelante.
- Limitar la altura vertical de `DataTable` exclusivamente en móviles (`max-h-80 md:max-h-none`) para habilitar scroll interno contenido con encabezados `sticky`, preservando el scroll natural de página entre widgets y el layout fijo de `100vh` en desktop (`md:`).

## Capabilities

### New Capabilities

### Modified Capabilities
- `market-dashboard-view`: Actualizar los requisitos de layout responsivo del `Header` en `< md` (ocultamiento de la tarjeta SMA20 y distribución de 2 filas sin desborde) y agregar contención de altura con scroll interno en `DataTable` para `< md`.

## Impact

- **Frontend**: `frontend/src/components/Header.tsx` y `frontend/src/components/Dashboard/DataTable.tsx`.
- **APIs / Backend / Base de datos**: Sin impacto; no se modifican endpoints, queries ni esquemas.
- **Desktop (`md:`+)**: Sin regresiones; `md:grid-cols-4` / `lg:grid-cols-5` y `md:max-h-none` preservan exactamente el comportamiento actual de tablet y desktop.
