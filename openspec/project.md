# Project: Kotegawa Multi-Strategy

## 1. Project Context
Kotegawa es un screener cuantitativo automatizado y bitácora (*Trading Journal*) diseñado para evaluar el *edge* matemático del mercado. El sistema está transitando de una persistencia en archivos estáticos (JSON: `history.json`, `backtest.json`, `meta.json`, `portfolio.json`) hacia una arquitectura relacional en la nube (Supabase) para orquestar un ecosistema Multi-Estrategia (iniciando con Kotegawa de reversión a la media, y extensible a otras estrategias como Tortugas).

Separa tajantemente el motor de análisis cuantitativo del cliente web: el backend se encarga de la recolección de datos, cálculo técnico/fundamental, ranking de candidatos y seguimiento autónomo del ciclo de vida de trades simulados (*backtest mocks*), mientras que el frontend visualiza el estado del mercado, métricas de rendimiento y recolecta las operaciones ejecutadas por el trader en la bitácora real.

## 2. Tech Stack
*   **Pipeline Cuantitativo (Backend):** Python 3.11+, `yfinance`, `pandas`, `supabase-py`.
*   **Orquestación:** GitHub Actions (Cronjob diario post-cierre de mercado ~21:30 UTC / 18:30 ART y `workflow_dispatch`).
*   **Cliente Visual (Frontend):** React (Vite), TypeScript, Tailwind CSS, `@supabase/supabase-js`, Lucide React, Recharts.
*   **Persistencia (BaaS):** Supabase (PostgreSQL), utilizando columnas `JSONB` para extensibilidad y *Row Level Security* (RLS).

## 3. Modelo de Entidades Centrales
1.  **`market_metadata`:** Registra las condiciones macro del mercado para el Header y control de riesgo:
    *   `id`: Clave primaria (o registro singleton / serie temporal).
    *   `vix_price`, `vix_change`: Nivel y variación del VIX (régimen Risk-On / Neutral / Risk-Off).
    *   `spy_price`, `spy_change`: Cierre y variación porcentual de SPY.
    *   `spy_history`: Serie histórica reciente (~20 ruedas) para el gráfico SparkLine (JSONB o array numérico).
    *   `sma20_bull_pct`: Amplitud de mercado (% de acciones del S&P 500 cotizando sobre su SMA de 20 días).
    *   `last_run`: Timestamp de la última ejecución del pipeline.
2.  **`screener_candidates`:** Oportunidades detectadas por los algoritmos:
    *   `created_at`: Fecha/timestamp del escaneo.
    *   `ticker`: Símbolo del activo (ej. `AAPL`, normalizado con guiones para Yahoo Finance).
    *   `strategy`: Identificador de la estrategia (ej. `kotegawa`).
    *   `close_price`: Precio de cierre del día analizado.
    *   `score`: Calificación algorítmica (ej. *Bounce Score* 0-100 en Kotegawa).
    *   `target`: Objetivo sugerido (ej. FrontRun SMA20).
    *   `stop_loss`: Stop Loss sugerido (ej. 1.5 ATR).
    *   `strategy_props`: Parámetros técnicos o métricas específicas de la estrategia en JSONB (ej. `z_score`, `rsi_14`, `atr_14`).
3.  **`trades`:** Bitácora unificada de posiciones teóricas y reales:
    *   `id`: Identificador único (UUID o autoincremental).
    *   `ticker`: Símbolo bursátil.
    *   `strategy`: Estrategia asociada (ej. `kotegawa`).
    *   `taken`: Booleano discriminador fundamental (`false` = simulación/mock de backtest, `true` = operación real del trader).
    *   `entry_date`, `entry_price`: Fecha y precio de apertura.
    *   `target`, `stop_loss`: Precios de objetivo y límite de pérdida.
    *   `status`: Estado del trade (`OPEN` o `CLOSED`).
    *   `exit_date`, `exit_price`: Fecha y precio de liquidación.
    *   `exit_reason`: Causa de salida (`TP`, `SL`, o cierre manual).
    *   `pnl_percent`: Rendimiento porcentual final.
    *   `days_held`: Duración de la posición en ruedas/días.
    *   `strategy_props`: Payload extensible (JSONB) para estado específico (ej. piramidación, número de unidades, *N* ATR, notas subjetivas del trader).

## 4. Reglas de Oro / Invariantes
1.  **Normalización Pura (Anti-Sparse):** Las tablas relacionales centrales (`market_metadata`, `screener_candidates`, `trades`) poseen columnas universales y fijas. Ningún requerimiento particular de una estrategia específica puede añadir columnas sueltas a estas entidades; todo dato o variable de estado exclusivo (ej. tamaño de unidad, *N*, trailing dinámico, razones de rechazo) debe almacenarse dentro del payload `strategy_props` (JSONB).
2.  **Frontera Hermética de Entornos (`taken`):** Ningún trade de prueba o simulación debe contaminar la estadística real del portfolio. Todo registro en `trades` requiere obligatoriamente el flag booleano `taken`:
    *   `taken = false`: Trades teóricos (mocks) originados automáticamente por el screener para medir el *edge* cuantitativo. Su ciclo de vida (evaluación de SL/TP por High/Low diario) es 100% gestionado por el backend Python.
    *   `taken = true`: Trades reales ingresados voluntariamente por el usuario a través de la bitácora (*Trading Journal*).
3.  **Roles de Escritura Asimétricos y Cero Secretos en Código:**
    *   El pipeline de Python opera como servicio de backend seguro usando credenciales maestras (`SUPABASE_SERVICE_ROLE_KEY`), administradas estrictamente mediante variables de entorno (`.env` local o GitHub Secrets), sin tokens hardcodeados en el código fuente.
    *   El frontend web en React accede a través de la `anon_key` para lectura pública y únicamente podrá crear/editar registros bajo políticas estrictas de autenticación y autorización (*Row Level Security* - RLS).
4.  **Desacoplamiento Lógico y Agnosticismo Financiero del Frontend:** El cliente web jamás calcula indicadores técnicos, gatillos de compra, *Bounce Scores*, ni recálculos dinámicos de Stop Loss. Su rol se limita estrictamente a renderizar el estado persistido en Supabase y recolectar las órdenes manuales y notas del usuario.
5.  **Idempotencia y Orden del Pipeline Diario:** La ejecución diaria del motor de Python (GitHub Actions) debe ser estrictamente secuencial e idempotente:
    1.  *Mantenimiento de Trades Abiertos:* Monitorear precios del día para cerrar trades con `status = 'OPEN'` que hayan alcanzado SL o TP.
    2.  *Escaneo y Calificación:* Calcular indicadores del universo (S&P 500) y persistir el Top de candidatos en `screener_candidates`.
    3.  *Generación de Mocks:* Añadir las nuevas posiciones teóricas correspondientes al día en `trades` (`taken = false`), evitando duplicados si la rutina se reejecuta en la misma fecha.
    4.  *Actualización Macro:* Publicar los metadatos agregados (VIX, SPY, SMA20 bull %) en `market_metadata`.
