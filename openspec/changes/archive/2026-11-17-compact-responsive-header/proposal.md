# Proposal

## Why

En pantallas de laptop y monitores medianos (`< 1920x1080`, como `1366x768`), el `<header>` actual consume ~125px de altura vertical debido a contenedores de imagen fijos (`w-30 h-30` = `120px` en Logo y Reloj), tipografías grandes (`text-3xl`, `text-2xl`, `text-xl`) y textos largos que hacen wrap en múltiples líneas. Esto reduce excesivamente el espacio vertical disponible de la Columna 1 dentro del layout fijo `md:h-screen` introducido en la Spec 1.5, forzando scroll prematuro en `Today's top 5` y en el formulario de `Trading Journal`.

## What Changes

- Invertir la estrategia responsiva en `frontend/src/components/Header.tsx` a un enfoque **Compact-First** (modo compacto por defecto para pantallas chicas y laptops, revelando textos largos, iconos secundarios y paddings amplios solo en `xl:` `>= 1280px` y `2xl:` `>= 1536px`), preservando intacta la estructura `md:h-screen` de la Spec 1.5:
  1. **Padding, tipografía base y grid del Header:** Reducir el gap y margen inferior del `<header>` (`gap-2 2xl:gap-3 mb-2 2xl:mb-3 shrink-0`), acotar el padding e interlineado de `MetricCard` (`p-2 2xl:p-3`), ajustar tamaños de valores (`text-base xl:text-lg 2xl:text-2xl font-semibold leading-tight whitespace-nowrap`) y soportar `subTextClassName` con renderizado condicional para evitar líneas vacías.
  2. **Tarjeta 1 (Logo):** Reducir el tamaño del logo de `w-30 h-30` a `w-11 h-11 xl:w-14 xl:h-14 2xl:w-24 2xl:h-24 shrink-0`, ajustar el título a `text-base xl:text-xl 2xl:text-2xl font-bold leading-tight` y ocultar el subtítulo `"Swing trading dashboard"` por debajo de `xl` (`hidden xl:block`).
  3. **Tarjeta 2 (SPY):** Mostrar `"SPY"` por defecto (`2xl:hidden`) y `"S&P 500 (SPY)"` únicamente en `2xl:` (`hidden 2xl:inline`), compactando el contenedor del `SparkLine` a `w-24 h-12 xl:w-28 xl:h-14 2xl:w-40 2xl:h-20`.
  4. **Tarjeta 3 (VIX):** Mostrar `"VIX"` por defecto (`2xl:hidden`) y `"Volatility Index"` en `2xl:` (`hidden 2xl:inline`), ocultar el icono de ayuda `(?)` y su tooltip por debajo de `xl` (`hidden xl:flex` / `hidden xl:block`), y reducir el margen superior del badge (`mt-1 2xl:mt-4`).
  5. **Tarjeta 4 (SMA20):** Ocultar el subtítulo `"Bullish participation"` en pantallas menores a `xl` (`subTextClassName="hidden xl:block"`) y ajustar el ancho mínimo y margen de la barra de progreso (`min-w-[90px] xl:min-w-[120px] 2xl:min-w-[150px] mt-1.5 2xl:mt-3`).
  6. **Tarjeta 5 (Cronjob):** Ocultar la palabra `"Cronjob"` y el icono del reloj por debajo de `xl` (`hidden xl:inline` y `hidden xl:flex` con tamaño `xl:w-12 xl:h-12 2xl:w-20 2xl:h-20`), y agrupar fecha y hora en una sola línea en resoluciones `< 2xl` (`{cronDate} {cronTime}`) manteniendo la vista en dos líneas para `2xl:`.

## Capabilities

### New Capabilities
*(Ninguna)*

### Modified Capabilities
- `market-dashboard-view`: Incorporar el modo compacto responsivo (`Compact-First`) en el `Header` para pantallas `< 1920x1080` sin alterar el viewport fijo `md:h-screen` de la Spec 1.5.

## Impact

- **Frontend afectado:** `frontend/src/components/Header.tsx`
- **Compatibilidad:** Preserva los contratos de datos de Supabase (`market_metadata`) y el comportamiento `md:h-screen md:overflow-hidden` de [App.tsx](file:///f:/Users/matias/Documents/Programacion/Trading/StockScreener/frontend/src/App.tsx) y [Dashboard.tsx](file:///f:/Users/matias/Documents/Programacion/Trading/StockScreener/frontend/src/components/Dashboard/Dashboard.tsx).
