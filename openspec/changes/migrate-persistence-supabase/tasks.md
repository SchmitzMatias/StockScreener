# Tasks

## 1. Dependencias y Configuración de Clientes Supabase

- [x] 1.1 Actualizar `backend/requirements.txt` con `supabase` y `python-dotenv`, y verificar instalación limpia en entorno virtual.
- [x] 1.2 Configurar variables de entorno en `backend/.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) y sanitizar `backend/data_migration.py` para eliminar credenciales expuestas en texto plano.
- [x] 1.3 Agregar `@supabase/supabase-js` a `frontend/package.json` e instalar la dependencia con `npm install`.
- [x] 1.4 Crear el cliente singleton de Supabase en `frontend/src/lib/supabase.ts` consumiendo `import.meta.env.VITE_SUPABASE_URL` y `import.meta.env.VITE_SUPABASE_ANON_KEY`, verificando que exporte el cliente tipado.

## 2. Refactor y Persistencia en Backend (Python)

- [x] 2.1 Modificar `backend/scoring_engine.py` para unificar el cálculo de `Target_FrontRun` bajo la regla DRY RRR 1:0.85 (`close_price + (close_price - stop_loss) * 0.85`), y verificar mediante prueba unitaria/script de prueba que devuelva el target esperado.
- [x] 2.2 Implementar en `backend/data_loader.py` (o módulo de utilidad de base de datos) la función `sanitize_for_db(data)` que reemplace recursivamente `NaN`, `Inf` y tipos `numpy` por `None` y tipos nativos de Python.
- [x] 2.3 Refactorizar `evaluate_open_trades` en `backend/data_loader.py` para consultar posiciones con `status = 'OPEN'` y `taken = false` en la tabla `trades` de Supabase y actualizar a `CLOSED` con `exit_reason`, `exit_price`, `pnl_percent` y `days_held` cuando toquen TP o SL.
- [x] 2.4 Refactorizar `append_new_trades` en `backend/data_loader.py` para insertar nuevos mocks en `trades` con `taken = false`, reutilizando el target exacto calculado por el screener sin recalcular.
- [x] 2.5 Reemplazar la escritura a `history.json` en `backend/data_loader.py` por inserción en `screener_candidates`, mapeando columnas universales e inyectando métricas específicas (`RSI`, `Z-Score`, `ATR_14`) en `strategy_props` (JSONB).
- [x] 2.6 Reemplazar la escritura a `meta.json` en `backend/data_loader.py` por upsert en `market_metadata` (`id = 1`) incluyendo `last_run`, `spy_price`, `spy_change`, `spy_history`, `vix_price`, `vix_change` y `sma20_bull_pct`.

## 3. Adaptación Asíncrona en Frontend (React)

- [x] 3.1 Actualizar las interfaces y definiciones de columnas en `frontend/src/components/Dashboard/DashboardTables.tsx` a `snake_case` coincidente con el esquema relacional (`ticker`, `close_price`, `score`, `target`, `stop_loss`, `entry_price`, `exit_price`, `exit_reason`, `pnl_percent`, `days_held`).
- [x] 3.2 Refactorizar `frontend/src/components/Header.tsx` para eliminar el import estático de `meta.json`, consultar `market_metadata` de Supabase mediante `useEffect`, e incorporar guardas defensivas para `spy_history` y renderizado seguro del `SparkLine`.
- [x] 3.3 Refactorizar `frontend/src/components/Dashboard/Dashboard.tsx` para eliminar los imports de `history.json`, `backtest.json` y `portfolio.json`, consultando asíncronamente `screener_candidates` y `trades` (segregados por `taken = false` para teóricos y `taken = true` para bitácora real).
- [x] 3.4 Validar que `npm run build` en el frontend compile sin errores de tipado en TypeScript ni advertencias de imports rotos.

## 4. Verificación de Integración de Extremo a Extremo

- [x] 4.1 Ejecutar el flujo del backend (`data_loader.py`) verificando que la base de datos Supabase reciba registros válidos en `market_metadata`, `screener_candidates` y `trades` sin errores de serialización JSON.
- [x] 4.2 Iniciar el frontend con `npm run dev` y verificar que el Header, las 3 columnas del Dashboard y los footers de rendimiento se rendericen con los datos vivos de Supabase.

