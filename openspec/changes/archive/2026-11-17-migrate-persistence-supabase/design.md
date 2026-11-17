# Design

## Context

El sistema cuenta con un pipeline de análisis cuantitativo en Python (`backend/data_loader.py`) ejecutado por GitHub Actions y una interfaz de usuario en React/Vite (`frontend/`). Actualmente, toda la comunicación entre ambos actores se realiza mediante archivos JSON estáticos en `data/` embebidos en el bundle de Vite. La migración a Supabase (PostgreSQL) sustituye este canal por conexiones a base de datos relacional con RLS, respetando el contrato de entidades descrito en `openspec/project.md`.

## Goals / Non-Goals

**Goals:**
- Centralizar la persistencia en las tablas `market_metadata`, `screener_candidates` y `trades`.
- Implementar un cliente singleton de Supabase en Python (`backend`) usando credenciales `service_role` mediante variables de entorno.
- Implementar un cliente singleton de Supabase en TypeScript (`frontend`) usando la clave pública `anon_key`.
- Unificar el cálculo de `target` aplicando el principio DRY en `scoring_engine.py` con RRR 1:0.85 y reutilizándolo en `trades`.
- Transformar el consumo de datos en React de síncrono a asíncrono con estados reactivos (`useState`, `useEffect`) y manejo de errores.
- Sanitizar arrays y escalares numéricos de Python (`NaN`, `Inf`, `numpy` types) para evitar fallas de serialización en PostgreSQL.

**Non-Goals:**
- Implementar la inserción de trades reales desde el formulario `TradeEntryForm` (se mantiene mockeado para una Spec posterior).
- Integración de APIs de brokers o ejecución de órdenes automatizadas.
- Modificar la lógica matemática de indicadores de Kotegawa (salvo la unificación de la fórmula de Target).

## Decisions

### 1. Desacoplamiento de Credenciales y Ambientes
- **Decisión:** El backend Python utilizará `SUPABASE_SERVICE_ROLE_KEY` obtenida de `os.getenv` mediante `python-dotenv` para omitir restricciones RLS al escribir. El frontend utilizará `VITE_SUPABASE_ANON_KEY` con permisos de solo lectura vía RLS.
- **Alternativa descartada:** Usar la misma clave pública en ambos actores (rechazado por violar Invariante #3 y comprometer permisos de inserción).

### 2. Unificación DRY del Cálculo de Target (RRR 1:0.85)
- **Decisión:** En `scoring_engine.py`, la propiedad `Target_FrontRun` (que se almacenará como `target` en `screener_candidates`) se calcula como:
  `target = close_price + ((close_price - stop_loss) * 0.85)`
  Posteriormente, `data_loader.py` reutiliza este valor exacto al crear registros en `trades` (`taken = false`), eliminando discrepancias entre el screener y el backtest.
- **Alternativa descartada:** Calcular `target = SMA_20 * 0.98` en el screener y recalcular RRR 0.85 en el backtest (descartado por inconsistencia cognitiva y duplicación de lógica).

### 3. Sanitización Defensiva Anti-NaN en Python
- **Decisión:** Implementar una utilidad recursiva `sanitize_for_db(obj)` antes de cada llamada a `supabase.table(...).insert()` / `.upsert()`. Convierte `pd.isna(x)` e `isinstance(x, float) and math.isnan(x)` en `None` (JSON `null`), y tipos `np.generic` a tipos nativos de Python.
- **Alternativa descartada:** Confiar en la serialización por defecto de `postgrest-py` (descartado porque lanza `ValueError: Out of range float values` con `NaN`).

### 4. Mapeo a Convención `snake_case` en Frontend
- **Decisión:** Actualizar las interfaces de TypeScript (`DashboardTables.tsx`) a `snake_case` nativo de la base de datos (`ticker`, `close_price`, `score`, `target`, `stop_loss`, `entry_price`, `exit_price`, `exit_reason`, `pnl_percent`, `days_held`).
- **Alternativa descartada:** Mantener interfaces en PascalCase con un middleware de transformación en cliente (descartado por agregar sobrecarga innecesaria).

### 5. Arquitectura de Estado Asíncrono en React
- **Decisión:** Proveer hooks o estados locales en `Dashboard.tsx` y `Header.tsx` con guardas defensivas (`data?.length > 0`) antes de invocar métodos de formato (`.toFixed()`, `.split()`) o alimentar componentes gráficos (`SparkLine`).
- **Alternativa descartada:** Mantener imports estáticos como fallback (descartado para evitar desfases de información y bundling obsoleto).

## Risks / Trade-offs

- **[Riesgo: Pantalla en blanco por render asíncrono]** → *Mitigación:* Inicializar estados con valores por defecto o arrays vacíos, e incluir verificación defensiva antes de indexar elementos de `spy_history`.
- **[Riesgo: Formato de timestamp `last_run`]** → *Mitigación:* Almacenar timestamp en ISO o formatear con `new Date(data.last_run).toLocaleDateString()` en lugar de asumir `split(' ')`.
- **[Riesgo: Duplicación en ejecuciones repetidas del Cronjob]** → *Mitigación:* Usar `.upsert()` con clave primaria en `market_metadata` (`id = 1`) y constraints de unicidad o verificación previa por fecha en `screener_candidates` y `trades`.

