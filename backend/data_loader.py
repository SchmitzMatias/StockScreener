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

def evaluate_open_trades(supabase_client: Optional[Client] = None) -> List[Dict[str, Any]]:
    """
    Consulta los trades teóricos abiertos (status == 'OPEN' y taken == False) en Supabase,
    verifica el precio High/Low de la rueda de hoy con yfinance y actualiza a 'CLOSED'
    en la tabla 'trades' si alcanza el SL o TP.
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
        if not ticker:
            continue

        try:
            ticker_obj = yf.Ticker(ticker)
            data = ticker_obj.history(period="1d")
            if data.empty:
                continue

            low = float(data["Low"].to_numpy().flatten()[-1])
            high = float(data["High"].to_numpy().flatten()[-1])

            entry_price = float(trade["entry_price"])
            stop_loss = float(trade["stop_loss"])
            target = float(trade["target"])

            exit_reason = None
            exit_price = None

            if low <= stop_loss:
                exit_reason = "SL"
                exit_price = round(stop_loss, 2)
            elif high >= target:
                exit_reason = "TP"
                exit_price = round(target, 2)

            if exit_reason and exit_price is not None:
                pnl_percent = round(((exit_price - entry_price) / entry_price) * 100, 2)
                entry_date_raw = str(trade.get("entry_date", today_str))[:10]
                entry_date_obj = datetime.strptime(entry_date_raw, "%Y-%m-%d")
                days_held = max(0, (datetime.now() - entry_date_obj).days)

                update_payload = sanitize_for_db({
                    "status": "CLOSED",
                    "exit_date": today_str,
                    "exit_price": exit_price,
                    "exit_reason": exit_reason,
                    "pnl_percent": pnl_percent,
                    "days_held": days_held,
                })

                client.table("trades").update(update_payload).eq("id", trade["id"]).execute()
                logger.info(f"[{ticker}] Trade #{trade['id']} cerrado por {exit_reason} a ${exit_price} ({pnl_percent}%)")
                closed_trades.append({**trade, **update_payload})
        except Exception as e:
            logger.error(f"[{ticker}] Error evaluando trade abierto #{trade.get('id')}: {e}")

    return closed_trades


def append_new_trades(
    top5_candidates: List[Dict[str, Any]],
    today_str: str,
    supabase_client: Optional[Client] = None
) -> List[Dict[str, Any]]:
    """
    Inserta los nuevos trades teóricos de hoy (taken = False) en la tabla 'trades' de Supabase,
    reutilizando exactamente el 'Target_FrontRun' y 'Stop_Loss_Sugerido' calculados por el screener (DRY).
    Evita duplicados si ya existen mocks para la misma fecha y ticker.
    """
    client = supabase_client or get_supabase_client()
    inserted_trades = []

    try:
        existing_resp = (
            client.table("trades")
            .select("ticker")
            .eq("entry_date", today_str)
            .eq("strategy", "kotegawa")
            .eq("taken", False)
            .execute()
        )
        existing_tickers = {row["ticker"] for row in (existing_resp.data or [])}
    except Exception as e:
        logger.warning(f"No se pudo verificar existencia previa de trades para {today_str}: {e}")
        existing_tickers = set()

    for candidate in top5_candidates:
        ticker = candidate["Ticker"]
        if ticker in existing_tickers:
            logger.info(f"[{ticker}] Mock trade ya registrado para {today_str}, omitiendo duplicado.")
            continue

        new_trade = sanitize_for_db({
            "ticker": ticker,
            "strategy": "kotegawa",
            "taken": False,
            "entry_date": today_str,
            "entry_price": round(float(candidate["Price"]), 2) if candidate.get("Price") is not None else None,
            "target": round(float(candidate["Target_FrontRun"]), 2) if candidate.get("Target_FrontRun") is not None else None,
            "stop_loss": round(float(candidate["Stop_Loss_Sugerido"]), 2) if candidate.get("Stop_Loss_Sugerido") is not None else None,
            "status": "OPEN",
            "exit_date": None,
            "exit_price": None,
            "exit_reason": None,
            "pnl_percent": None,
            "days_held": None,
            "strategy_props": {},
        })

        try:
            res = client.table("trades").insert(new_trade).execute()
            if res.data:
                inserted_trades.extend(res.data)
            else:
                inserted_trades.append(new_trade)
        except Exception as e:
            logger.error(f"[{ticker}] Error al insertar mock trade en Supabase: {e}")

    logger.info(f"Se insertaron {len(inserted_trades)} nuevos trades teóricos en Supabase.")
    return inserted_trades


def persist_screener_candidates(
    top5_candidates: List[Dict[str, Any]],
    today_str: str,
    supabase_client: Optional[Client] = None
) -> List[Dict[str, Any]]:
    """
    Persiste los candidatos del día en 'screener_candidates' mapeando las columnas universales
    e inyectando las métricas específicas ('rsi', 'z_score', 'atr_14') en 'strategy_props' (JSONB).
    """
    client = supabase_client or get_supabase_client()
    inserted_candidates = []

    try:
        existing_resp = (
            client.table("screener_candidates")
            .select("ticker")
            .eq("created_at", today_str)
            .eq("strategy", "kotegawa")
            .execute()
        )
        existing_tickers = {row["ticker"] for row in (existing_resp.data or [])}
    except Exception as e:
        logger.warning(f"No se pudo verificar candidatos previos para {today_str}: {e}")
        existing_tickers = set()

    for c in top5_candidates:
        ticker = c.get("Ticker")
        if ticker in existing_tickers:
            logger.info(f"[{ticker}] Candidato ya registrado en screener_candidates para {today_str}, omitiendo duplicado.")
            continue

        candidate_base = {
            "created_at": today_str,
            "ticker": ticker,
            "strategy": "kotegawa",
            "close_price": c.get("Price"),
            "score": c.get("Bounce_Score"),
            "target": c.get("Target_FrontRun"),
            "stop_loss": c.get("Stop_Loss_Sugerido"),
        }
        candidate_with_props = sanitize_for_db({
            **candidate_base,
            "strategy_props": {
                "rsi": c.get("RSI"),
                "z_score": c.get("Z-Score"),
                "atr_14": c.get("ATR_14"),
            },
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
                logger.error(f"[{ticker}] Error al insertar candidato en screener_candidates: {e}")

    logger.info(f"Se persistieron {len(inserted_candidates)} candidatos en screener_candidates.")
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
    }
    full_payload = sanitize_for_db({
        **base_payload,
        "last_run": meta_data.get("last_run"),
        "spy_history": meta_data.get("spy_history", []),
    })

    try:
        client.table("market_metadata").upsert(full_payload).execute()
        logger.info("Metadata macro actualizada exitosamente en Supabase (market_metadata id=1).")
        return full_payload
    except Exception as e:
        if "PGRST204" in str(e) or "last_run" in str(e) or "spy_history" in str(e):
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

    logger.info("Iniciando ejecución del pipeline diario Kotegawa hacia Supabase...")
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

            if not df_procesado.empty:
                tickers_filtrados = filter_base_technical(df_procesado)

                if tickers_filtrados:
                    top_5_results = apply_fundamental_filters_and_score(tickers_filtrados, df_procesado)

                    if top_5_results:
                        print("\n" + "=" * 50)
                        print("🚀 TOP 5 - SELECCIÓN FINAL 'BOUNCE SCORE' 🚀")
                        print("=" * 50)
                        print(json.dumps(sanitize_for_db(top_5_results), indent=4))

                        # Persistir candidatos en screener_candidates
                        persist_screener_candidates(top_5_results, fecha_hoy, supabase)

                        # 3. Generación de Mocks en trades (Invariante #5.3)
                        append_new_trades(top_5_results, fecha_hoy, supabase)
                    else:
                        logger.info("No hay candidatas hoy que cumplan todos los filtros (Fundamentales/Scoring).")
                else:
                    logger.warning("Ningún ticker pasó el filtro base técnico. No hay candidatas hoy.")

                # 4. Actualización Macro en market_metadata (Invariante #5.4)
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