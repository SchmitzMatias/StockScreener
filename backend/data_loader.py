import pandas as pd
import yfinance as yf
import logging
from typing import List, Dict, Any
from datetime import datetime
import os

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
                    else:
                        logger.info("No hay candidatas hoy que cumplan todos los filtros (Fundamentales/Scoring).")
                else:
                    logger.warning("Ningún ticker pasó el filtro base técnico. No hay candidatas hoy.")
        else:
            logger.error("No se descargaron datos históricos.")