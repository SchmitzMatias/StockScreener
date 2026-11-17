# Design

## Context

Ver `proposal.md` para la motivación del problema. Actualmente `frontend/src/components/Header.tsx` utiliza un layout diseñado para monitores amplios (`1920x1080`), donde:
- Las imágenes de Logo (Card 1) y Reloj (Card 5) reservan `w-30 h-30` (`120px x 120px`) fijos desde móvil hasta escritorio.
- Los textos largos (`"S&P 500(SPY)"`, `"Volatility Index"`, `"Swing trading dashboard"`, `"Bullish participation"`) y las tipografías grandes (`text-3xl`, `text-2xl`, `text-xl`) generan saltos de línea y empujan la altura del `<header>` por encima de ~125px en laptops (`1366x768`).
- Dentro del layout `md:h-screen` establecido en la Spec 1.5, cada píxel vertical extra en el `<header>` se resta directamente a las columnas inferiores, afectando principalmente a la Columna 1 (`Today's top 5` y `Trading Journal`).

## Goals / Non-Goals

**Goals:**
- Reducir drásticamente la altura total del `<header>` en pantallas `< 1536px` (`< 2xl`, incluyendo laptops `1366x768`) mediante un enfoque **Compact-First**.
- Evitar saltos de línea no deseados en títulos, métricas numéricas y timestamps dentro de las 5 tarjetas del header.
- Conservar toda la información completa (títulos extensos, subtítulos, tooltip `(?)` del VIX, icono del reloj y paddings amplios) en monitores grandes (`xl:` y `2xl:`).
- Mantener intacta la estructura `md:h-screen md:overflow-hidden` de `App.tsx` y `Dashboard.tsx`.

**Non-Goals:**
- Modificar el layout de 3 columnas ni los breakpoints `md:` definidos en la Spec 1.5.
- Alterar la lógica de consulta a Supabase, el formato del `SparkLine` SVG o los umbrales de régimen del VIX.
- Reestructurar `Header.tsx` en múltiples archivos de componentes separados.

## Decisions

### 1. Inversión a estrategia Compact-First (`base` -> `xl:` -> `2xl:`)
- **Decisión:** Definir como estilo base las clases compactas (paddings reducidos, títulos cortos `"SPY"` y `"VIX"`, tipografía acotada, ocultamiento de subtítulos e iconos secundarios), usar `xl:` (`>= 1280px`, que abarca laptops `1366x768`) para mostrar de forma contenida el subtítulo del logo, el tooltip `(?)` del VIX, `"Bullish participation"`, la etiqueta `"Cronjob"` y un reloj compacto, y usar `2xl:` (`>= 1536px`, monitores `1920x1080`) para restaurar los títulos completos (`"S&P 500 (SPY)"`, `"Volatility Index"`), el formato de Cronjob en dos líneas y los paddings/tamaños generosos.
- **Alternativa descartada:** Mantener los estilos grandes por defecto y aplicar `max-2xl:` o sobreescrituras negativas en `md:`/`lg:`. Se descarta porque contradice el paradigma *mobile-first / compact-first* de Tailwind CSS y multiplica la complejidad de especificidad de clases.

### 2. Extensión de `MetricCardProps` con `subTextClassName` y renderizado condicional
- **Decisión:** Añadir la prop opcional `subTextClassName?: string` a `MetricCard` en `Header.tsx` y renderizar `title` y `subText` solo cuando tienen contenido truthy (`title && ...`, `subText && ...`). Esto permite ocultar `"Bullish participation"` en `< xl` con `subTextClassName="hidden xl:block"` y evita que `title=""` (Card 4) o un `subText` vacío generen nodos con altura residual en modo compacto.
- **Alternativa descartada:** Pasar un nodo JSX complejo como `subText` en lugar de `string`. Se descarta para no romper `getColorClass(subText: string)`, que inspecciona `+` y `-` sobre el string para aplicar color verde/rojo.

### 3. Mapa exacto de clases Tailwind por componente en `frontend/src/components/Header.tsx`

| Elemento | Clases Actuales | Clases Propuestas (Spec 1.6) | Efecto en `< 2xl` vs `2xl:` |
| :--- | :--- | :--- | :--- |
| `<header>` (L157) | `grid grid-cols-3 lg:grid-cols-5 gap-3 mb-3 shrink-0` | `grid grid-cols-3 lg:grid-cols-5 gap-2 2xl:gap-3 mb-2 2xl:mb-3 shrink-0` | Reduce separación entre tarjetas y margen inferior debajo de `2xl`. |
| `MetricCard` contenedor (L49) | `bg-panel border border-slate-800 rounded-lg flex justify-around items-center shadow-sm ${className \|\| ''}` | `bg-panel border border-slate-800 rounded-lg flex justify-around items-center gap-1.5 2xl:gap-2 p-2 2xl:p-3 shadow-sm ${className \|\| ''}` | Compacta padding interno a `p-2` en `< 2xl` y restaura `p-3` en `2xl:`. |
| `MetricCard` title (L51) | `<span className='text-xl'>{title}</span>` | `{title && <span className='block text-xs xl:text-sm 2xl:text-xl text-slate-300 leading-tight'>{title}</span>}` | Evita títulos sobredimensionados y nodos vacíos en Card 4. |
| `MetricCard` value (L52) | `<div className='text-2xl font-semibold'>{value}</div>` | `<div className='text-base xl:text-lg 2xl:text-2xl font-semibold leading-tight whitespace-nowrap'>{value}</div>` | Escala valores numéricos sin saltos de línea. |
| `MetricCard` subText (L53) | `<div className={getColorClass(subText)}>{subText}</div>` | `{subText && <div className={\`text-xs 2xl:text-sm leading-tight ${getColorClass(subText)} ${subTextClassName \|\| ''}\`}>{subText}</div>}` | Permite ocultar subtítulos en `< xl` y compacta interlineado. |
| **Card 1:** Contenedor Logo (L159-160) | Card: `border border-slate-800 bg-panel flex rounded-lg items-center`<br>Img box: `w-30 h-30 shrink-0` | Card: `border border-slate-800 bg-panel flex rounded-lg items-center p-2 2xl:p-3`<br>Img box: `w-11 h-11 xl:w-14 xl:h-14 2xl:w-24 2xl:h-24 shrink-0` | Baja el alto mínimo del header de `120px` a `44px` (`< xl`) / `56px` (`xl:`) / `96px` (`2xl:`). |
| **Card 1:** Título y subtítulo (L167-170) | Wrapper: `hidden lg:block ml-3`<br>`h1`: `text-3xl font-bold`<br>`p`: sin clases | Wrapper: `hidden lg:block ml-2 2xl:ml-3 min-w-0`<br>`h1`: `text-base xl:text-xl 2xl:text-2xl font-bold leading-tight whitespace-nowrap`<br>`p`: `hidden xl:block text-xs 2xl:text-sm text-slate-400 leading-tight` | Oculta `"Swing trading dashboard"` en `< xl` y evita wrap en `"Stock Screener"`. |
| **Card 2:** SPY título y SparkLine (L176-180) | `title="S&P 500(SPY)"`<br>Chart: `w-40 h-20 text-accent` | `title`: `<><span className="2xl:hidden">SPY</span><span className="hidden 2xl:inline">S&P 500 (SPY)</span></>`<br>Chart: `w-24 h-12 xl:w-28 xl:h-14 2xl:w-40 2xl:h-20 text-accent` | Muestra `"SPY"` en `< 2xl` y ajusta la altura del SparkLine a `48px`/`56px`/`80px`. |
| **Card 3:** VIX título, `(?)` y badge (L194-217) | Título: `text-gray-400 text-sm` (`Volatility Index`) + icono `(?)` siempre visible<br>Badge wrap: `mt-4`<br>Badge: `px-2 py-1 text-l font-semibold rounded` | Título wrap: `flex items-center gap-1.5 relative group cursor-help w-max`<br>Texto: `<span className="text-gray-400 text-xs xl:text-sm"><span className="2xl:hidden">VIX</span><span className="hidden 2xl:inline">Volatility Index</span></span>`<br>Icono `(?)`: `hidden xl:flex ... w-4 h-4 ...` y tooltip `hidden xl:block ...`<br>Badge wrap: `mt-1 2xl:mt-4`<br>Badge: `px-2 py-0.5 2xl:py-1 text-xs xl:text-sm font-semibold rounded whitespace-nowrap` | Oculta `(?)` en `< xl`, muestra `"VIX"` en `< 2xl` y reduce margen del badge. |
| **Card 4:** SMA20 subtítulo y barra (L224-227) | `subText="Bullish participation"`<br>Barra: `block w-full min-w-[150px] h-2 bg-slate-700 rounded-full mt-3 overflow-hidden` | `subText="Bullish participation"` + `subTextClassName="hidden xl:block"`<br>Barra: `block w-full min-w-[90px] xl:min-w-[120px] 2xl:min-w-[150px] h-2 bg-slate-700 rounded-full mt-1.5 2xl:mt-3 overflow-hidden` | Oculta `"Bullish participation"` en `< xl` y evita desbordamiento horizontal en tarjetas estrechas. |
| **Card 5:** Cronjob título, fecha/hora y reloj (L236-247) | `title="Cronjob"`<br>`value={cronDate}`<br>`subText={cronTime}`<br>Reloj: `w-30 h-30 shrink-0 hidden lg:flex` | `title={<span className="hidden xl:inline">Cronjob</span>}`<br>`value={<><span className="2xl:hidden">{cronTime ? \`${cronDate} ${cronTime}\` : cronDate}</span><span className="hidden 2xl:inline">{cronDate}</span></>}`<br>`subText={cronTime}` + `subTextClassName="hidden 2xl:block"`<br>Reloj: `hidden xl:flex xl:w-12 xl:h-12 2xl:w-20 2xl:h-20 shrink-0` | En `< 2xl` agrupa fecha y hora en 1 línea; oculta `"Cronjob"` y reloj en `< xl`; restaura reloj y 2 líneas en `2xl:`. |

## Risks / Trade-offs

- **[Riesgo: Ancho ajustado en 5 columnas alrededor de `1024px–1280px` (`lg:` / `xl:`)]** → *Mitigación:* En `lg:` se ocultan subtítulos e iconos secundarios (`hidden xl:block`), se abrevian los títulos (`SPY`, `VIX`) y se compactan la barra SMA20 (`min-w-[90px]`) y el SparkLine (`w-24`), evitando colisiones horizontales.
- **[Riesgo: Tooltip `(?)` del VIX oculto en `< 1280px`]** → *Mitigación:* El badge de régimen (`Risk-On`, `Neutral`, `Risk-Off`) y su codificación por color permanecen siempre visibles en todas las resoluciones, y la leyenda detallada sigue disponible en `xl:` (`>= 1280px`).
