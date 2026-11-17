import pandas as pd
import numpy as np
import yfinance as yf
import logging
import math
from typing import List, Dict, Any, Optional
from datetime import datetime
import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Carga de variables de entorno (.env local en backend/ o raíz del proyecto)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """Retorna la instancia singleton del cliente de Supabase con credenciales de backend."""
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.")
        _supabase_client = create_client(url, key)
    return _supabase_client

def sanitize_for_db(data: Any) -> Any:
    """
    Reemplaza recursivamente NaN, Inf y tipos escalares de NumPy (np.floating, np.integer, np.bool_)
    por None y tipos nativos de Python para garantizar serialización JSON limpia hacia PostgreSQL.
    """
    if data is None:
        return None
    if isinstance(data, dict):
        return {str(k): sanitize_for_db(v) for k, v in data.items()}
    if isinstance(data, (list, tuple)):
        return [sanitize_for_db(v) for v in data]
    if isinstance(data, (np.bool_, bool)):
        return bool(data)
    if isinstance(data, (np.integer, int)):
        return int(data)
    if isinstance(data, (np.floating, float)):
        val = float(data)
        if math.isnan(val) or math.isinf(val):
            return None
        return val
    try:
        if pd.isna(data):
            return None
    except (TypeError, ValueError):
        pass
    return data

def get_sp500_tickers() -> List[str]:
    """
    Extrae la lista de tickers del S&P 500 desde un dataset open-source en Github.
    Limpia los tickers reemplazando puntos por guiones (ej. BRK.B a BRK-B) 
    para asegurar la compatibilidad con Yahoo Finance.
    """
    logger.info("Extrayendo tickers del S&P 500 desde CSV en Github...")
    url = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
    
    try:
        # pd.read_csv lee directamente desde la URL
        df = pd.read_csv(url)
        tickers = df['Symbol'].tolist()
        
        # Limpieza de tickers: yfinance usa '-' en lugar de '.'
        clean_tickers = [ticker.replace('.', '-') for ticker in tickers]
        logger.info(f"Se extrajeron y limpiaron {len(clean_tickers)} tickers exitosamente.")
        
        return clean_tickers
    except Exception as e:
        logger.error(f"Error al extraer los tickers desde CSV: {e}")
        return []

def get_spy_metrics():
    """Descarga 1 mes de SPY para calcular el precio, variación y la curva del gráfico."""
    try:
        spy = yf.Ticker("SPY")
        data = spy.history(period="1mo") # ~20 a 22 ruedas operativas
        
        if len(data) >= 2:
            closes = data['Close'].to_numpy().flatten()
            
            current_price = float(closes[-1])
            prev_close = float(closes[-2])
            pct_change = ((current_price - prev_close) / prev_close) * 100
            
            # Convertimos la lista de numpy a una lista normal de Python redondeada a 2 decimales
            history_list = [round(float(price), 2) for price in closes]
            
            return round(current_price, 2), round(pct_change, 2), history_list
    except Exception as e:
        logger.error(f"Error al obtener SPY: {e}")
        
    return 0.0, 0.0, []

def get_vix_metrics():
    """Descarga últimos 5 días del VIX para calcular el precio actual y variación."""
    try:
        vix = yf.Ticker("^VIX")
        data = vix.history(period="5d")
        
        if len(data) >= 2:
            closes = data['Close'].to_numpy().flatten()
            current_price = float(closes[-1])
            prev_close = float(closes[-2])
            pct_change = ((current_price - prev_close) / prev_close) * 100
            
            return round(current_price, 2), round(pct_change, 2)
    except Exception as e:
        logger.error(f"Error al obtener VIX: {e}")
        
    return 0.0, 0.0

def download_historical_data(tickers: List[str], period: str = "250d") -> pd.DataFrame:
    """
    Descarga los datos históricos diarios (OHLCV) en modo batch para una lista de tickers.
    
    Args:
        tickers: Lista de símbolos bursátiles.
        period: Periodo de datos a descargar (por defecto '250d' para ~250 días hábiles).
        
    Returns:
        pd.DataFrame: DataFrame con los datos descargados.
    """
    logger.info(f"Descargando datos históricos para {len(tickers)} tickers (periodo: {period})...")
    try:
        # yf.download en modo batch optimiza la red y evita rate-limiting.
        # threads=False previene bloqueos de SQLite (OperationalError) en la caché local de yfinance.
        # auto_adjust=True ajusta los precios por splits y dividendos automáticamente.
        data = yf.download(
            tickers, 
            period=period, 
            interval="1d",
            group_by='ticker', 
            threads=False,
            auto_adjust=True
        )
        logger.info("Descarga en batch completada exitosamente.")
        return data
    except Exception as e:
        logger.error(f"Error al descargar datos históricos en batch: {e}")
        return pd.DataFrame()

def get_ticker_fundamentals(ticker: str) -> Dict[str, Any]:
    """
    Extrae los datos fundamentales (objeto 'info') y el calendario de eventos 
    (para buscar la próxima fecha de 'Earnings') de un ticker.
    
    Maneja excepciones devolviendo None para los datos faltantes, sin romper la ejecución.
    
    Args:
        ticker: Símbolo bursátil (ej. 'AAPL').
        
    Returns:
        Dict con las claves 'info' y 'next_earnings_date'.
    """
    logger.debug(f"Extrayendo fundamentales para {ticker}...")
    result = {
        'info': None,
        'next_earnings_date': None
    }
    
    try:
        ticker_obj = yf.Ticker(ticker)
        
        # 1. Extraer objeto 'info' (fundamentales)
        try:
            result['info'] = ticker_obj.info
        except Exception as e:
            logger.warning(f"[{ticker}] No se pudo extraer 'info': {e}")
            
        # 2. Extraer fecha del próximo reporte de Earnings
        try:
            calendar = ticker_obj.calendar
            # Dependiendo de la versión de yfinance, el calendario puede venir en diferentes formatos
            if isinstance(calendar, dict) and 'Earnings Date' in calendar:
                dates = calendar['Earnings Date']
                if isinstance(dates, list) and len(dates) > 0:
                    result['next_earnings_date'] = dates[0]
            elif isinstance(calendar, pd.DataFrame) and not calendar.empty:
                if 'Earnings Date' in calendar.index:
                    dates = calendar.loc['Earnings Date']
                    if len(dates) > 0:
                        result['next_earnings_date'] = dates[0]
            else:
                # Intento alternativo para versiones más recientes usando get_earnings_dates
                try:
                    earnings = ticker_obj.get_earnings_dates(limit=1)
                    if earnings is not None and not earnings.empty:
                        result['next_earnings_date'] = earnings.index[0]
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"[{ticker}] No se pudo extraer el calendario de earnings: {e}")
            
    except Exception as e:
        logger.error(f"[{ticker}] Error general al procesar el Ticker: {e}")
        
    return result

MAX_OPEN_POSITIONS_PER_STRATEGY = 5
ENABLED_STRATEGIES = ["kotegawa", "turtle"]


def normalize_kotegawa_candidates(raw_candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convierte la salida del scoring_engine de Kotegawa al contrato unificado multi-estrategia."""
    normalized = []
    for c in raw_candidates:
        normalized.append({
            "ticker": c.get("Ticker"),
            "close_price": c.get("Price"),
            "score": c.get("Bounce_Score"),
            "target": c.get("Target_FrontRun"),
            "stop_loss": c.get("Stop_Loss_Sugerido"),
            "strategy_props": {
                "rsi": c.get("RSI"),
                "z_score": c.get("Z-Score"),
                "atr_14": c.get("ATR_14"),
            },
        })
    return normalized


def evaluate_open_trades(supabase_client: Optional[Client] = None) -> List[Dict[str, Any]]:
    """
    Evalúa los trades teóricos abiertos (status == 'OPEN' y taken == False) en Supabase:
    - 'kotegawa': Cierra por SL fijo o TP fijo (RRR 1:0.85).
    - 'turtle':
        1) Descarga ventana '1mo' para calcular Donchian Low 10d y evalúa cierre por
           Stop 2N ('SL') o Trailing Stop 10d ('TRAILING_STOP').
        2) Si sobrevive, evalúa piramidación (+0.5N hasta máx 4 unidades) actualizando
           entry_price promedio ponderado, stop_loss y strategy_props en la misma fila.
    """
    client = supabase_client or get_supabase_client()
    today_str = datetime.now().strftime("%Y-%m-%d")
    closed_trades = []

    try:
        response = (
            client.table("trades")
            .select("*")
            .eq("status", "OPEN")
            .eq("taken", False)
            .execute()
        )
        open_trades = response.data or []
    except Exception as e:
        logger.error(f"Error al consultar trades abiertos en Supabase: {e}")
        return []

    logger.info(f"Evaluando {len(open_trades)} trades teóricos abiertos en Supabase...")

    for trade in open_trades:
        ticker = trade.get("ticker")
        strategy = trade.get("strategy", "kotegawa")
        if not ticker:
            continue

        entry_date_raw = str(trade.get("entry_date", today_str))[:10]
        if entry_date_raw == today_str:
            continue

        try:
            ticker_obj = yf.Ticker(ticker)
            history_period = "1mo" if strategy == "turtle" else "1d"
            data = ticker_obj.history(period=history_period)
            if data.empty:
                continue

            low_today = float(data["Low"].to_numpy().flatten()[-1])
            high_today = float(data["High"].to_numpy().flatten()[-1])

            entry_price = float(trade["entry_price"])
            stop_loss = float(trade["stop_loss"])
            target = float(trade["target"]) if trade.get("target") is not None else None
            props = dict(trade.get("strategy_props") or {})

            exit_reason = None
            exit_price = None

            if strategy == "kotegawa":
                if low_today <= stop_loss:
                    exit_reason = "SL"
                    exit_price = round(stop_loss, 2)
                elif target is not None and high_today >= target:
                    exit_reason = "TP"
                    exit_price = round(target, 2)

            elif strategy == "turtle":
                low_series = pd.Series(data["Low"].to_numpy().flatten(), dtype=float)
                low_10_series = low_series.shift(1).rolling(window=10).min()
                donchian_low_10 = (
                    round(float(low_10_series.iloc[-1]), 2)
                    if len(low_10_series) >= 11 and not pd.isna(low_10_series.iloc[-1])
                    else round(float(props.get("trailing_stop_10d", stop_loss)), 2)
                )

                stop_2n = float(props.get("stop_2n", stop_loss))
                effective_stop = max(stop_2n, donchian_low_10)

                if low_today <= effective_stop:
                    if donchian_low_10 >= stop_2n and low_today <= donchian_low_10:
                        exit_reason = "TRAILING_STOP"
                        exit_price = round(donchian_low_10, 2)
                    else:
                        exit_reason = "SL"
                        exit_price = round(stop_2n, 2)
                else:
                    units = int(props.get("units", 1))
                    max_units = int(props.get("max_units", 4))
                    n_entry = float(props.get("n_at_entry", 0.0))
                    next_pyramid = props.get("next_pyramid_price")
                    unit_fills = list(props.get("unit_fills", [entry_price]))

                    pyramided = False
                    while (
                        units < max_units
                        and n_entry > 0
                        and next_pyramid is not None
                        and high_today >= float(next_pyramid)
                    ):
                        fill_price = round(float(next_pyramid), 2)
                        entry_price = round(((entry_price * units) + fill_price) / (units + 1), 2)
                        units += 1
                        unit_fills.append(fill_price)
                        stop_2n = round(fill_price - (2.0 * n_entry), 2)
                        next_pyramid = (
                            round(fill_price + (0.5 * n_entry), 2)
                            if units < max_units
                            else None
                        )
                        pyramided = True

                    new_effective_stop = round(max(stop_2n, donchian_low_10), 2)
                    props.update({
                        "units": units,
                        "unit_fills": unit_fills,
                        "stop_2n": stop_2n,
                        "trailing_stop_10d": donchian_low_10,
                        "next_pyramid_price": next_pyramid,
                    })

                    if pyramided or new_effective_stop != stop_loss:
                        open_update = sanitize_for_db({
                            "entry_price": entry_price,
                            "stop_loss": new_effective_stop,
                            "strategy_props": props,
                        })
                        client.table("trades").update(open_update).eq("id", trade["id"]).execute()
                        if pyramided:
                            logger.info(
                                f"[{ticker}] Piramidación Tortuga -> {units} unidades | "
                                f"Avg Entry: ${entry_price} | Nuevo Stop: ${new_effective_stop}"
                            )

            if exit_reason and exit_price is not None:
                pnl_percent = round(((exit_price - entry_price) / entry_price) * 100, 2)
                entry_date_obj = datetime.strptime(entry_date_raw, "%Y-%m-%d")
                days_held = max(1, (datetime.now() - entry_date_obj).days)

                update_payload = sanitize_for_db({
                    "status": "CLOSED",
                    "exit_date": today_str,
                    "exit_price": exit_price,
                    "exit_reason": exit_reason,
                    "pnl_percent": pnl_percent,
                    "days_held": days_held,
                    "strategy_props": props,
                })

                client.table("trades").update(update_payload).eq("id", trade["id"]).execute()
                logger.info(
                    f"[{ticker}][{strategy}] Trade #{trade['id']} cerrado por {exit_reason} "
                    f"a ${exit_price} ({pnl_percent}%)"
                )
                closed_trades.append({**trade, **update_payload})
        except Exception as e:
            logger.error(f"[{ticker}] Error evaluando trade abierto #{trade.get('id')}: {e}")

    return closed_trades


def append_new_trades(
    candidates: List[Dict[str, Any]],
    today_str: str,
    strategy: str = "kotegawa",
    supabase_client: Optional[Client] = None
) -> List[Dict[str, Any]]:
    """
    Inserta nuevos trades teóricos (taken = False) para la estrategia dada,
    respetando el límite de Portfolio Heat (MAX_OPEN_POSITIONS_PER_STRATEGY = 5)
    y evitando duplicados de tickers ya OPEN o registrados en la misma fecha.
    """
    client = supabase_client or get_supabase_client()
    inserted_trades = []

    try:
        open_resp = (
            client.table("trades")
            .select("ticker")
            .eq("strategy", strategy)
            .eq("status", "OPEN")
            .eq("taken", False)
            .execute()
        )
        open_tickers = {row["ticker"] for row in (open_resp.data or [])}

        today_resp = (
            client.table("trades")
            .select("ticker")
            .eq("entry_date", today_str)
            .eq("strategy", strategy)
            .eq("taken", False)
            .execute()
        )
        today_tickers = {row["ticker"] for row in (today_resp.data or [])}
    except Exception as e:
        logger.error(f"[{strategy}] Error verificando Portfolio Heat en trades: {e}")
        return []

    current_open_count = len(open_tickers)
    available_slots = max(0, MAX_OPEN_POSITIONS_PER_STRATEGY - current_open_count)

    if available_slots == 0:
        logger.info(
            f"[{strategy}] Portfolio Heat al máximo ({current_open_count}/"
            f"{MAX_OPEN_POSITIONS_PER_STRATEGY} posiciones OPEN). No se abren nuevos mocks hoy."
        )
        return []

    logger.info(
        f"[{strategy}] Posiciones abiertas: {current_open_count}/{MAX_OPEN_POSITIONS_PER_STRATEGY}. "
        f"Slots disponibles hoy: {available_slots}."
    )

    sorted_candidates = sorted(
        candidates,
        key=lambda c: float(c.get("score") or 0.0),
        reverse=True,
    )
    eligible_candidates = [
        c for c in sorted_candidates
        if c.get("ticker") and c["ticker"] not in open_tickers and c["ticker"] not in today_tickers
    ]
    candidates_to_open = eligible_candidates[:available_slots]

    for candidate in candidates_to_open:
        ticker = candidate["ticker"]
        entry_price = round(float(candidate["close_price"]), 2) if candidate.get("close_price") is not None else None
        stop_loss = round(float(candidate["stop_loss"]), 2) if candidate.get("stop_loss") is not None else None
        target = round(float(candidate["target"]), 2) if candidate.get("target") is not None else None

        cand_props = dict(candidate.get("strategy_props") or {})
        if strategy == "turtle" and entry_price is not None:
            n_val = float(cand_props.get("n_value") or cand_props.get("atr_20") or 0.0)
            trade_props = {
                "n_at_entry": round(n_val, 2),
                "initial_entry_price": entry_price,
                "units": 1,
                "max_units": 4,
                "unit_fills": [entry_price],
                "stop_2n": stop_loss,
                "trailing_stop_10d": cand_props.get("donchian_low_10", stop_loss),
                "next_pyramid_price": round(entry_price + (0.5 * n_val), 2) if n_val > 0 else None,
                "donchian_high_20_entry": cand_props.get("donchian_high_20"),
            }
        else:
            trade_props = {}

        new_trade = sanitize_for_db({
            "ticker": ticker,
            "strategy": strategy,
            "taken": False,
            "entry_date": today_str,
            "entry_price": entry_price,
            "target": target,
            "stop_loss": stop_loss,
            "status": "OPEN",
            "exit_date": None,
            "exit_price": None,
            "exit_reason": None,
            "pnl_percent": None,
            "days_held": None,
            "strategy_props": trade_props,
        })

        try:
            res = client.table("trades").insert(new_trade).execute()
            if res.data:
                inserted_trades.extend(res.data)
            else:
                inserted_trades.append(new_trade)
        except Exception as e:
            logger.error(f"[{ticker}][{strategy}] Error al insertar mock trade en Supabase: {e}")

    logger.info(f"[{strategy}] Se insertaron {len(inserted_trades)} nuevos trades teóricos en Supabase.")
    return inserted_trades


def persist_screener_candidates(
    candidates: List[Dict[str, Any]],
    today_str: str,
    strategy: str = "kotegawa",
    supabase_client: Optional[Client] = None
) -> List[Dict[str, Any]]:
    """
    Persiste los candidatos del día en 'screener_candidates' para la estrategia indicada,
    mapeando las columnas universales y guardando las métricas específicas en 'strategy_props' (JSONB).
    """
    client = supabase_client or get_supabase_client()
    inserted_candidates = []

    try:
        existing_resp = (
            client.table("screener_candidates")
            .select("ticker")
            .eq("created_at", today_str)
            .eq("strategy", strategy)
            .execute()
        )
        existing_tickers = {row["ticker"] for row in (existing_resp.data or [])}
    except Exception as e:
        logger.warning(f"[{strategy}] No se pudo verificar candidatos previos para {today_str}: {e}")
        existing_tickers = set()

    for c in candidates:
        ticker = c.get("ticker")
        if not ticker or ticker in existing_tickers:
            if ticker in existing_tickers:
                logger.info(f"[{ticker}][{strategy}] Candidato ya registrado para {today_str}, omitiendo duplicado.")
            continue

        candidate_base = {
            "created_at": today_str,
            "ticker": ticker,
            "strategy": strategy,
            "close_price": c.get("close_price"),
            "score": c.get("score"),
            "target": c.get("target"),
            "stop_loss": c.get("stop_loss"),
        }
        candidate_with_props = sanitize_for_db({
            **candidate_base,
            "strategy_props": c.get("strategy_props") or {},
        })

        try:
            res = client.table("screener_candidates").insert(candidate_with_props).execute()
            if res.data:
                inserted_candidates.extend(res.data)
            else:
                inserted_candidates.append(candidate_with_props)
        except Exception as e:
            if "strategy_props" in str(e) or "PGRST204" in str(e):
                clean_base = sanitize_for_db(candidate_base)
                res = client.table("screener_candidates").insert(clean_base).execute()
                if res.data:
                    inserted_candidates.extend(res.data)
                else:
                    inserted_candidates.append(clean_base)
            else:
                logger.error(f"[{ticker}][{strategy}] Error al insertar candidato en screener_candidates: {e}")

    logger.info(f"[{strategy}] Se persistieron {len(inserted_candidates)} candidatos en screener_candidates.")
    return inserted_candidates


def persist_market_metadata(
    meta_data: Dict[str, Any],
    supabase_client: Optional[Client] = None
) -> Dict[str, Any]:
    """
    Realiza un upsert idempotente en 'market_metadata' (id = 1) con todas las métricas macro.
    """
    client = supabase_client or get_supabase_client()
    base_payload = {
        "id": 1,
        "vix_price": meta_data.get("vix_price"),
        "vix_change": meta_data.get("vix_change"),
        "sma20_bull_pct": meta_data.get("sma20_bull_pct"),
        "spy_price": meta_data.get("spy_price"),
        "spy_change": meta_data.get("spy_change"),
        "spy_history": meta_data.get("spy_history", []),
    }
    full_payload = sanitize_for_db({
        **base_payload,
        "last_run": meta_data.get("last_run"),
        "updated_at": datetime.now().isoformat(),
    })

    try:
        client.table("market_metadata").upsert(full_payload).execute()
        logger.info("Metadata macro actualizada exitosamente en Supabase (market_metadata id=1).")
        return full_payload
    except Exception as e:
        if "PGRST204" in str(e) or "last_run" in str(e):
            fallback_payload = sanitize_for_db({
                **base_payload,
                "updated_at": datetime.now().isoformat(),
            })
            client.table("market_metadata").upsert(fallback_payload).execute()
            logger.info("Metadata macro actualizada en Supabase (esquema base con updated_at).")
            return fallback_payload
        logger.error(f"Error al hacer upsert en market_metadata: {e}")
        raise


if __name__ == "__main__":
    from technical_analysis import process_technical_indicators, filter_base_technical
    from scoring_engine import apply_fundamental_filters_and_score
    from turtle_engine import run_turtle_strategy

    logger.info("Iniciando ejecución del pipeline diario Multi-Estrategia hacia Supabase...")
    supabase = get_supabase_client()
    fecha_hoy = datetime.now().strftime("%Y-%m-%d")

    # 1. Mantenimiento de Trades Abiertos (Invariante #5.1)
    evaluate_open_trades(supabase)

    # 2. Escaneo y Calificación del S&P 500 (Invariante #5.2)
    sp500 = get_sp500_tickers()

    if sp500:
        sample = sp500[:500]
        logger.info(f"Tickers a escanear: {len(sample)}")

        df_historico = download_historical_data(sample, period="250d")

        if not df_historico.empty:
            df_procesado = process_technical_indicators(df_historico)

            for strategy_name in ENABLED_STRATEGIES:
                logger.info(f"--- Ejecutando estrategia: {strategy_name} ---")
                strategy_candidates: List[Dict[str, Any]] = []

                if strategy_name == "kotegawa":
                    if not df_procesado.empty:
                        tickers_filtrados = filter_base_technical(df_procesado)
                        if tickers_filtrados:
                            raw_top5 = apply_fundamental_filters_and_score(tickers_filtrados, df_procesado)
                            strategy_candidates = normalize_kotegawa_candidates(raw_top5)
                        else:
                            logger.warning("[kotegawa] Ningún ticker pasó el filtro base técnico.")
                elif strategy_name == "turtle":
                    strategy_candidates = run_turtle_strategy(df_historico)

                if strategy_candidates:
                    print("\n" + "=" * 50)
                    print(f"🚀 TOP {len(strategy_candidates)} - ESTRATEGIA '{strategy_name.upper()}' 🚀")
                    print("=" * 50)
                    print(json.dumps(sanitize_for_db(strategy_candidates), indent=4))

                    persist_screener_candidates(strategy_candidates, fecha_hoy, strategy_name, supabase)
                    # 3. Generación de Mocks en trades respetando Portfolio Heat (Invariante #5.3)
                    append_new_trades(strategy_candidates, fecha_hoy, strategy_name, supabase)
                else:
                    logger.info(f"[{strategy_name}] No hay candidatas hoy que cumplan todos los filtros.")

            # 4. Actualización Macro en market_metadata (Invariante #5.4)
            if not df_procesado.empty:
                current_time = datetime.now().strftime("%Y-%m-%d %H:%M")
                spy_price, spy_change, spy_history = get_spy_metrics()
                vix_price, vix_change = get_vix_metrics()

                df_reset = df_procesado.reset_index()
                last_day_df = df_reset.groupby("Ticker").last()
                total_scanned = len(last_day_df)
                above_sma20 = len(last_day_df[last_day_df["Close"] > last_day_df["SMA_20"]])
                sma20_bull_pct = round((above_sma20 / total_scanned) * 100, 2) if total_scanned > 0 else 0.0

                meta_data = {
                    "last_run": current_time,
                    "spy_price": spy_price,
                    "spy_change": spy_change,
                    "spy_history": spy_history,
                    "vix_price": vix_price,
                    "vix_change": vix_change,
                    "sma20_bull_pct": sma20_bull_pct,
                }

                persist_market_metadata(meta_data, supabase)
        else:
            logger.error("No se descargaron datos históricos.")