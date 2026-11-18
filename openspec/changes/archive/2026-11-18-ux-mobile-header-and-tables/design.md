# Design

## Context

Ver `proposal.md` para la motivación. Actualmente:
- `Header.tsx` utiliza `grid-cols-3 lg:grid-cols-5`, donde solo Card 2 (SPY) está oculta en `< lg` (`hidden lg:flex`), dejando 4 tarjetas visibles (Logo+Selector, VIX, SMA20, Cronjob) en 3 columnas.
- `App.tsx` y `Dashboard.tsx` restringen el alto al viewport únicamente desde `md:` (`md:h-screen md:overflow-hidden`, `md:min-h-0`), permitiendo que `DataTable.tsx` crezca sin tope vertical en `< md`.

## Goals / Non-Goals

**Goals:**
- Eliminar el desborde horizontal y el colapso de tarjetas en `< md` reorganizando el `Header` en 2 filas balanceadas (`grid-cols-2`), ocultando SMA20 en `< md` y manteniendo intacto el layout de `md:` (`4` cols) y `lg:` (`5` cols).
- Contener la altura de todas las instancias de `DataTable` en `< md` sin introducir estado de paginación ni alterar el scroll interno de desktop (`md:`).

**Non-Goals:**
- Agregar paginación del lado del cliente o servidor.
- Rediseñar columnas de tablas, formularios (`TradeEntryForm`), ni modales en mobile.

## Decisions

1. **Grid de Header `grid-cols-2 md:grid-cols-4 lg:grid-cols-5` con `col-span-2 md:col-span-1` en Card 1 y `hidden md:flex` en Card 4 (SMA20)**
   - *Por qué*: En anchos de 360px–390px, Card 1 (Logo + botones `Kotegawa`/`Turtle`) requiere ~170px mínimos; intentar mantener 3 tarjetas en una fila produce recorte o wrap. Pasar a `grid-cols-2` con `col-span-2` en Card 1 da ancho completo a la fila 1 (Logo a la izquierda, Selector a la derecha) y deja a VIX y Cronjob en 2 columnas iguales en la fila 2. En `md:` (`>= 768px`), `md:grid-cols-4` acomoda las 4 tarjetas visibles (incluyendo SMA20) en 1 fila sin dejar a Cronjob huérfano como ocurría con `grid-cols-3`.
   - *Alternativa descartada*: Integrar Cronjob dentro de Card 1 en mobile mediante un badge duplicado `md:hidden`, lo cual duplicaba markup y recargaba Card 1 en pantallas de 320px–360px.

2. **Contención de `DataTable.tsx` mediante `max-h-80 md:max-h-none` (Opción A: scroll interno)**
   - *Por qué*: `DataTable.tsx` ya cuenta con `overflow-y-auto` y `<thead className="sticky top-0 bg-panel z-10">`. Añadir `max-h-80 md:max-h-none` limita la altura en `< md` a `320px` (aprox. 7–8 filas visibles) manteniendo visibles los footers de KPIs en `Dashboard.tsx` y sin afectar el `flex-1 min-h-0` de desktop (`md:`).
   - *Alternativa descartada*: Paginación cliente de a 10 registros (Opción B), porque añade estado local (`page`), requiere reseteos al cambiar `activeStrategy` o sub-tab `CLOSED`/`OPEN`, introduce controles extra que ocupan espacio vertical, o requeriría media-queries en JS para no alterar el comportamiento actual de desktop.

## Risks / Trade-offs

- **Scroll anidado en pantallas táctiles (`< md`)** -> Al usar `max-h-80` (`320px`) en lugar de alturas mayores (`max-h-96` o `max-h-screen`), queda suficiente área fuera de cada tabla (títulos de `WidgetPanel`, sub-tabs, footers de KPIs y márgenes) para hacer scroll de página sin quedar atrapado dentro de la tabla.
- **Menor visibilidad de SMA20 en `< md`** -> Se oculta `Bullish participation` únicamente debajo de `768px`, priorizando legibilidad del selector de estrategia, VIX (régimen de riesgo) y fecha de última ejecución; sigue disponible desde `md:` en adelante.
