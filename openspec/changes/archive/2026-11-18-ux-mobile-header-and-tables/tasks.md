# Tasks

## 1. Reestructuración Mobile del Header

- [x] 1.1 Actualizar `frontend/src/components/Header.tsx` cambiando el grid del `<header>` a `grid-cols-2 md:grid-cols-4 lg:grid-cols-5`, agregando `col-span-2 md:col-span-1` a Card 1 (Logo + Selector) y `className="hidden md:flex"` a Card 4 (SMA20), verificando que en `< 768px` se muestren 2 filas sin desborde horizontal y en `md:` / `lg:` se mantenga 1 fila de 4 y 5 columnas respectivamente.

## 2. Contención de Tablas en Mobile

- [x] 2.1 Actualizar `frontend/src/components/Dashboard/DataTable.tsx` añadiendo `max-h-80 md:max-h-none` al contenedor scrolleable (`overflow-y-auto`), verificando que en `< 768px` cada tabla scrollee internamente con su `<thead>` sticky y que en `md:`+ se mantenga el scroll al 100% del viewport (`100vh`).

## 3. Verificación de Build

- [x] 3.1 Ejecutar `npm run build` en `frontend/` para verificar compilación TypeScript y bundle Vite sin errores ni warnings de sintaxis.
