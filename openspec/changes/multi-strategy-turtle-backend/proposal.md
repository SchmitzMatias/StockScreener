# Proposal

## Why

El pipeline cuantitativo actual (`backend/data_loader.py`) opera de forma mono-estrategia (exclusivamente reversión a la media con `kotegawa`) mientras que la lógica de seguimiento de tendencia (*Tortugas*) reside en scripts independientes (`turtle_script.py`, `turtle_small.py`, `turtle_ar.py`) desconectados de Supabase. Integrar un motor Tortugas vectorizado y multi-estrategia en el cronjob diario permite generar señales de *Trend Following* y simular su *edge* real (con piramidación y límite de *Portfolio Heat*) en la misma base relacional sin crear tablas nuevas.

## What Changes

- **Nuevo motor vectorizado de Tortugas (`backend/turtle_engine.py`):** Implementación en Pandas puro sobre el DataFrame batch del S&P 500 (`250d`) con filtro `Close > SMA_200`, liquidez `Avg_Vol_20 > 1,000,000`, ruptura Donchian de 20 días (`Close >= High_20`), control de riesgo nominal (`ATR_20 <= 10.00`), cálculo de Stop Loss inicial a `2N`, nivel de salida Donchian de 10 días (`Low_10`), gatillos de piramidación (`+0.5N`) y ranking Top 5 por `ATR_Pct` descendente.
- **Refactoreo multi-estrategia en `backend/data_loader.py`:**
  - `evaluate_open_trades`: Soporte diferenciado por `strategy`. Para `turtle`, descarga ventana de `1mo` para evaluar salida diaria por Stop `2N` o *Trailing Stop* Donchian de 10 días (`Low <= donchian_low_10`), y si la posición sigue abierta, evalúa piramidación hasta `4` unidades en intervalos de `+0.5N` actualizando en la misma fila `entry_price` (promedio ponderado), `stop_loss` y `strategy_props`.
  - `append_new_trades`: Implementación de **Portfolio Heat** con un tope estricto de `MAX_OPEN_POSITIONS_PER_STRATEGY = 5` posiciones `OPEN` concurrentes (`taken = false`), llenando únicamente los slots disponibles según el ranking de `score` y evitando duplicados de tickers ya abiertos.
  - `persist_screener_candidates` y loop principal (`__main__`): Parametrización por `strategy` e iteración secuencial sobre `['kotegawa', 'turtle']` reutilizando una única descarga histórica de `yfinance` (`period="250d"`).
- **Fuera de alcance (Fase B):** Todo cambio en el Frontend React (`App.tsx`, `Header.tsx`, `Dashboard.tsx`, `DashboardTables.tsx`, `TradeEntryForm.tsx`) queda explícitamente excluido de esta propuesta.

## Capabilities

### New Capabilities
- `turtle-strategy-engine`: Motor cuantitativo vectorizado de *Trend Following* (Sistema Tortugas S1 sobre S&P 500) con filtro `ATR_20 <= 10.00`, ruptura Donchian 20d, canal de salida 10d y cálculo de parámetros en `strategy_props`.

### Modified Capabilities
- `persistence-pipeline`: Extensión del pipeline diario para orquestar múltiples estrategias (`kotegawa` y `turtle`), soportar `target = null` en candidatos/trades sin TP fijo, gestionar piramidación y *Trailing Stop* Donchian 10d en `evaluate_open_trades`, y aplicar límite de *Portfolio Heat* (máximo 5 posiciones `OPEN` concurrentes por estrategia) en `append_new_trades`.

## Impact

- **Archivos nuevos:** `backend/turtle_engine.py`.
- **Archivos modificados:** `backend/data_loader.py`.
- **Base de datos (Supabase):** Sin cambios de esquema (respeta Invariante Anti-Sparse); inserta registros en `public.screener_candidates` y `public.trades` con `strategy = 'turtle'` y payload JSONB en `strategy_props`.
- **Orquestación:** `.github/workflows/daily_run.yml` continúa ejecutando `python data_loader.py` sin cambios en el workflow.
