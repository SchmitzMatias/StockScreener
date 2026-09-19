import pandas as pd
import yfinance as yf
import logging
from typing import List, Dict, Any
from datetime import datetime
import os
import json

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

def evaluate_open_trades(backtest_data: list) -> list:
    """
    Filtra los trades abiertos (Exit_Reason == None) y consulta el 
    precio High/Low de la rueda de hoy. Actualiza si toca SL o TP.
    """
    for trade in backtest_data:
        if trade.get("Exit_Reason") is not None:
            continue
            
        ticker = trade["Ticker"]
        
        # Usamos Ticker().history() en lugar de download()
        ticker_obj = yf.Ticker(ticker)
        data = ticker_obj.history(period="1d")
        
        if data.empty:
            continue
        
        # FIX INDESTRUCTIBLE: Convertimos a numpy crudo, aplanamos y sacamos el último valor.
        # Esto es inmune a si yfinance devuelve un DataFrame, una Serie o un MultiIndex.
        low = float(data['Low'].to_numpy().flatten()[-1])
        high = float(data['High'].to_numpy().flatten()[-1])
        
        entry_price = float(trade["Entry_Price"])
        stop_loss = float(trade["Stop_Loss"])
        target = float(trade["Target"])

        if low <= stop_loss:
            trade["Exit_Reason"] = "SL"
            trade["Exit_Price"] = round(stop_loss, 2)
            trade["PnL_Percent"] = round(((stop_loss - entry_price) / entry_price) * 100, 2)
            entry_date_obj = datetime.strptime(trade["Entry_Date"], "%Y-%m-%d")
            trade["Days_Held"] = (datetime.now() - entry_date_obj).days
        elif high >= target:
            trade["Exit_Reason"] = "TP"
            trade["Exit_Price"] = round(target, 2)
            trade["PnL_Percent"] = round(((target - entry_price) / entry_price) * 100, 2)
            entry_date_obj = datetime.strptime(trade["Entry_Date"], "%Y-%m-%d")
            trade["Days_Held"] = (datetime.now() - entry_date_obj).days
                
    return backtest_data

def append_new_trades(backtest_data: list, top5_candidates: list, today_str: str) -> list:
    """
    Calcula el Target dinámico basándose en un RRR 1:0.85 y el Stop Loss, 
    y anexa los nuevos trades de hoy al registro del backtest.
    """
    for candidate in top5_candidates:
        entry_price = candidate["Price"]
        stop_loss = candidate["Stop_Loss_Sugerido"]
        
        riesgo = entry_price - stop_loss
        target = entry_price + (riesgo * 0.85)
        
        new_trade = {
            "Entry_Date": today_str,
            "Ticker": candidate["Ticker"],
            "Entry_Price": round(entry_price, 2),
            "Target": round(target, 2),
            "Stop_Loss": round(stop_loss, 2),
            "Exit_Price": None,
            "Exit_Reason": None,
            "PnL_Percent": None,
            "Days_Held": None
        }
        backtest_data.append(new_trade)
        
    return backtest_data

def update_backtest_file(top5_candidates: list, backtest_file_path: str):
    """
    Flujo principal: Lee el JSON, evalúa los abiertos, añade los nuevos y sobrescribe de forma segura.
    """
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    if os.path.exists(backtest_file_path):
        with open(backtest_file_path, "r", encoding="utf-8") as f:
            try:
                backtest_data = json.load(f)
            except json.JSONDecodeError:
                backtest_data = []
    else:
        backtest_data = []

    backtest_data = evaluate_open_trades(backtest_data)
    backtest_data = append_new_trades(backtest_data, top5_candidates, today_str)
    
    with open(backtest_file_path, "w", encoding="utf-8") as f:
        json.dump(backtest_data, f, indent=4)

if __name__ == "__main__":
    import json
    from technical_analysis import process_technical_indicators, filter_base_technical
    from scoring_engine import apply_fundamental_filters_and_score
    
    # Bloque de prueba local integrando Partes 1, 2 y 3
    logger.info("Iniciando prueba rápida integral (Partes 1, 2 y 3)...")
    
    sp500 = get_sp500_tickers()
    
    if sp500:
        # Aumentamos la muestra a X tickers para tener más chances de que pasen los filtros invertidos
        sample = sp500[:500] 
        logger.info(f"Tickers de muestra: {sample}")
        
        # Descarga en batch (250d para SMA_200)
        df_historico = download_historical_data(sample, period="250d")
        
        if not df_historico.empty:
            # Procesar Parte 2: Análisis Técnico
            df_procesado = process_technical_indicators(df_historico)
            
            if not df_procesado.empty:
                # Filtrar tickers
                tickers_filtrados = filter_base_technical(df_procesado)
                
                # Procesar Parte 3: Scoring y Fundamentales
                if tickers_filtrados:
                    top_5_results = apply_fundamental_filters_and_score(tickers_filtrados, df_procesado)
                    
                    if top_5_results:
                        print("\n" + "="*50)
                        print("🚀 TOP 5 - SELECCIÓN FINAL 'BOUNCE SCORE' 🚀")
                        print("="*50)
                        print(json.dumps(top_5_results, indent=4))

                        # 1. Obtener la fecha actual (YYYY-MM-DD)
                        fecha_hoy = datetime.now().strftime("%Y-%m-%d")
                        
                        # 2. Definir la ruta al archivo
                        data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
                        os.makedirs(data_dir, exist_ok=True)
                        json_file_path = os.path.join(data_dir, "history.json")

                        # 3. Leer json histórico como un diccionario
                        historical_data = {}
                        if os.path.exists(json_file_path):
                            with open(json_file_path, 'r', encoding='UTF-8') as f:
                                try:
                                    data = json.load(f)
                                    # Proteccion: si detecta la lista plana de pruebas anteriores, la ignora
                                    if isinstance(data, dict):
                                        historical_data = data
                                    else:
                                        logger.warning("Formato JSON antiguo (lista) detectado. Se reinicia a Diccionario (Key-Value).")
                                except json.JSONDecodeError:
                                    logger.warning("El archivo JSON existía pero estaba corrupto/vacío.")
                        
                        # 4. Insersion o sobre-escritura O(1)
                        historical_data[fecha_hoy] = top_5_results

                        # 5. Escritura en el archivo
                        with open(json_file_path, 'w', encoding='utf-8') as f:
                            json.dump(historical_data, f, indent=4)

                        logger.info(f"Resultados exportados bajo la clave '{fecha_hoy}' en {json_file_path}")

                        # 6. Actualizar paper trading (backtest.json)
                        backtest_file_path = os.path.join(data_dir, "backtest.json")
                        update_backtest_file(top_5_results, backtest_file_path)
                        logger.info(f"Backtest paper trading actualizado en {backtest_file_path}")

                        # 7. Crear el recibo de última ejecución (Metadata)
                        current_time = datetime.now().strftime("%Y-%m-%d %H:%M") # Formato: YYYY-MM-DD HH:MM
                        spy_price, spy_change, spy_history = get_spy_metrics()
                        vix_price, vix_change = get_vix_metrics()
                        
                        # Calculo de % de stocks sobre SMA20 usando df_procesado
                        df_reset = df_procesado.reset_index()
                        last_day_df = df_reset.groupby('Ticker').last()
                        total_scanned = len(last_day_df)
                        above_sma20 = len(last_day_df[last_day_df['Close'] > last_day_df['SMA_20']])
                        sma20_bull_pct = round((above_sma20 / total_scanned) * 100, 2) if total_scanned > 0 else 0

                        meta_data = {
                            "last_run": current_time,
                            "spy_price": spy_price,
                            "spy_change": spy_change,
                            "spy_history": spy_history,
                            "vix_price": vix_price,
                            "vix_change": vix_change,
                            "sma20_bull_pct": sma20_bull_pct
                        }

                        meta_file_path = os.path.join(data_dir, "meta.json")
                        with open(meta_file_path, "w", encoding="utf-8") as f:
                            json.dump(meta_data, f, indent=4)

                        logger.info(f"Metadata actualizada en {meta_file_path}")
                    else:
                        logger.info("No hay candidatas hoy que cumplan todos los filtros (Fundamentales/Scoring).")
                else:
                    logger.warning("Ningún ticker pasó el filtro base técnico. No hay candidatas hoy.")
        else:
            logger.error("No se descargaron datos históricos.")