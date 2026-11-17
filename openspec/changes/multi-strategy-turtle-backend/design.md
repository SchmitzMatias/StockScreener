# Design

## Context

El backend actual (`backend/data_loader.py`, `backend/technical_analysis.py`, `backend/scoring_engine.py`) ejecuta únicamente la estrategia `kotegawa` sobre una descarga batch diaria del S&P 500 (`period="250d"`). En `/backend/` coexisten tres scripts sueltos de Tortugas (`turtle_script.py`, `turtle_small.py`, `turtle_ar.py`) que descargan datos ticker por ticker y no persisten en Supabase. Ver `proposal.md` para la motivación completa.

Restricciones clave del proyecto:
- **Anti-Sparse:** No se crean tablas ni columnas nuevas en Supabase; toda la data específica de Tortugas vive en `strategy_props` (`JSONB`).
- **Idempotencia:** La ejecución diaria debe ser segura ante re-ejecuciones en la misma fecha y evitar *look-ahead bias*.
- **Alcance Fase A:** Exclusivamente Backend Python (`backend/turtle_engine.py` y `backend/data_loader.py`). El Frontend React se abordará en Fase B.

## Goals / Non-Goals

**Goals:**
- Crear `backend/turtle_engine.py` vectorizado en Pandas puro sobre el mismo `df_historico` (`250d`) del S&P 500, reutilizando la lógica core de `turtle_small.py` (`ATR_20 <= 10.00`, `Close > SMA_200`, `Avg_Vol_20 > 1_000_000`, `Close >= High_20`, ranking Top 5 por `ATR_Pct`).
- Unificar un contrato de salida de candidatos entre `kotegawa` y `turtle` para que `persist_screener_candidates` y `append_new_trades` operen de forma agnóstica a la estrategia.
- Implementar en `evaluate_open_trades` la simulación realista de Tortugas: salida por `SL` (`2N`) o `TRAILING_STOP` (mínimo Donchian de 10 días) y piramidación hasta `4` unidades cada `+0.5N` en una **fila única** en `trades`.
- Implementar en `append_new_trades` el límite estricto de **Portfolio Heat** (`MAX_OPEN_POSITIONS_PER_STRATEGY = 5`).

**Non-Goals:**
- Integración de `turtle_ar.py` (MERVAL en ARS / API BYMA) en el cronjob US.
- Modificaciones en el Frontend React, Supabase Auth/RLS o `.github/workflows/daily_run.yml`.
- Eliminación física de los scripts legacy `turtle_*.py` (pueden quedar como referencia o deprecarse aparte).

## Decisions

### 1. Vectorización de `turtle_engine.py` sobre `df_historico` compartido
- **Decisión:** Implementar `run_turtle_strategy(df_raw: pd.DataFrame) -> List[Dict[str, Any]]` apilando el DataFrame MultiIndex de `yf.download` (mismo patrón que `technical_analysis.py`) y calculando `SMA_200`, `High_20` (`High.shift(1).rolling(20).max()`), `Low_10` (`Low.shift(1).rolling(10).min()`), `Avg_Vol_20`, `TR` y `ATR_20` (`TR.rolling(20).mean()`).
- **Alternativa considerada:** Invocar `turtle_small.py` con `ThreadPoolExecutor` haciendo otras 500 descargas HTTP. Descartada por latencia, riesgo de *rate-limit* de Yahoo Finance y duplicación de I/O.

### 2. Modelado de Piramidación: Fila Única Agregada en `trades` vs. Múltiples Filas
- **Decisión:** Mantener **1 fila por campaña/posición** en `trades` (`taken = false`). Cuando se dispara una piramidación (`High >= next_pyramid_price` y `units < 4`), se actualiza la misma fila recalculando `entry_price` como promedio ponderado de las unidades, elevando `stop_2n` (`fill_price - 2 * n_at_entry`), actualizando `stop_loss = max(stop_2n, donchian_low_10)` y registrando el detalle en `strategy_props` (`units`, `unit_fills`, `next_pyramid_price`, `trailing_stop_10d`).
- **Alternativa considerada:** Insertar una fila nueva en `trades` por cada unidad piramidada. Descartada porque inflaría artificialmente el conteo de *Portfolio Heat* (1 ticker con 4 unidades consumiría 4 de los 5 slots) y distorsionaría el cálculo de *Win Rate* en el dashboard.

### 3. Orden Conservador en `evaluate_open_trades` (Anti Look-Ahead)
- **Decisión:** En cada evaluación diaria de un trade `turtle` abierto, se descarga `history(period="1mo")` para calcular `donchian_low_10` sobre las 10 ruedas previas cerradas (`Low.shift(1).rolling(10).min()`). Se evalúa **primero** la condición de salida (`Low <= max(stop_2n, donchian_low_10)`) y solo si sobrevive la sesión se evalúa la piramidación (`High >= next_pyramid_price`). Además, se omiten trades cuya `entry_date == today_str` para garantizar idempotencia ante re-ejecuciones el mismo día.
- **Alternativa considerada:** Usar `period="1d"` como en Kotegawa. Descartada porque `1d` no permite recalcular el canal Donchian móvil de 10 días.

### 4. Contrato Normalizado de Candidato y Esquema `strategy_props`
Tanto `kotegawa` como `turtle` devuelven diccionarios normalizados con claves universales (`ticker`, `close_price`, `score`, `target`, `stop_loss`, `strategy_props`) para `persist_screener_candidates` y `append_new_trades`.

Payload `strategy_props` para `turtle` en `screener_candidates`:
```json
{
  "n_value": 5.95,
  "atr_20": 5.95,
  "atr_pct": 4.25,
  "donchian_high_20": 138.50,
  "donchian_low_10": 131.20,
  "sma_200": 118.40,
  "avg_vol_20": 45200000,
  "stop_distance_n": 2.0,
  "pyramid_triggers": {
    "unit_2": 142.98,
    "unit_3": 145.95,
    "unit_4": 148.93
  }
}
```

Payload `strategy_props` inicial para `turtle` en `trades`:
```json
{
  "n_at_entry": 5.95,
  "initial_entry_price": 140.00,
  "units": 1,
  "max_units": 4,
  "unit_fills": [140.00],
  "stop_2n": 128.10,
  "trailing_stop_10d": 131.20,
  "next_pyramid_price": 142.98,
  "donchian_high_20_entry": 138.50
}
```

## Risks / Trade-offs

- **Columna `target` en `screener_candidates` / `trades`:** En Tortugas `target` es `None` (`null` en PostgreSQL). → *Mitigación:* Verificar que el esquema actual en Supabase permita `NULL` en `target` (si tuviera restricción `NOT NULL`, requeriría `ALTER COLUMN target DROP NOT NULL` en SQL Editor, lo cual debe validarse durante la implementación/prueba).
- **Límite de velas intradía en piramidación + stop en el mismo día:** Al operar con barras diarias (`1d`), no es posible saber si `High` ocurrió antes que `Low`. → *Mitigación:* Aplicar prioridad conservadora evaluando siempre el Stop Loss antes que la piramidación.
- **Compatibilidad de Frontend hasta Fase B:** Mientras no se ejecute la Fase B, el frontend seguirá consultando sin filtro `.eq('strategy', activeStrategy)`. → *Mitigación:* Fase B se ejecutará inmediatamente después de validar Fase A.
