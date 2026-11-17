# Tasks

## 1. Refactor Compact-First del Contenedor Base y `MetricCard` (`Header.tsx`)

- [x] 1.1 Actualizar `<header>` (`gap-2 2xl:gap-3 mb-2 2xl:mb-3 shrink-0`) y `MetricCard` en `frontend/src/components/Header.tsx` para usar padding compacto (`p-2 2xl:p-3`), tipografía escalada sin salto de línea (`text-base xl:text-lg 2xl:text-2xl font-semibold leading-tight whitespace-nowrap`), render condicional de `title` y `subText`, y soporte para la prop opcional `subTextClassName?: string`, verificando que TypeScript compile sin errores de interfaz.

## 2. Adaptación Responsiva de las 5 Tarjetas del Header (`Header.tsx`)

- [x] 2.1 Refactorizar Card 1 (Logo) y Card 2 (SPY) en `frontend/src/components/Header.tsx`: reducir el logo a `w-11 h-11 xl:w-14 xl:h-14 2xl:w-24 2xl:h-24 shrink-0`, ajustar el título `h1` a `text-base xl:text-xl 2xl:text-2xl font-bold leading-tight whitespace-nowrap` y ocultar `"Swing trading dashboard"` con `hidden xl:block`; alternar `"SPY"` (`2xl:hidden`) y `"S&P 500 (SPY)"` (`hidden 2xl:inline`) y compactar el contenedor del `SparkLine` (`w-24 h-12 xl:w-28 xl:h-14 2xl:w-40 2xl:h-20`), verificando que las clases correspondan al diseño.
- [x] 2.2 Refactorizar Card 3 (VIX), Card 4 (SMA20) y Card 5 (Cronjob) en `frontend/src/components/Header.tsx`: alternar `"VIX"` (`2xl:hidden`) y `"Volatility Index"` (`hidden 2xl:inline`), ocultar el icono `(?)` y su tooltip en `< xl` (`hidden xl:flex` / `hidden xl:block`), y compactar el badge (`mt-1 2xl:mt-4`, `py-0.5 2xl:py-1 text-xs xl:text-sm`); ocultar `"Bullish participation"` en `< xl` (`subTextClassName="hidden xl:block"`) y ajustar la barra a `min-w-[90px] xl:min-w-[120px] 2xl:min-w-[150px] mt-1.5 2xl:mt-3`; ocultar `"Cronjob"` y el reloj en `< xl` (`hidden xl:inline` y `hidden xl:flex xl:w-12 xl:h-12 2xl:w-20 2xl:h-20`) y agrupar `{cronDate}` y `{cronTime}` en una sola línea en `< 2xl`, verificando que las clases correspondan al diseño.

## 3. Verificación de Build y Layout

- [x] 3.1 Ejecutar `npm run build` en `frontend/` y verificar que Vite compile con código de salida `0` y emita las utilidades responsivas `xl:` y `2xl:` en el bundle CSS resultante, manteniendo intacto el comportamiento `md:h-screen` de la Spec 1.5.
