import yfinance as yf
import pandas as pd
import numpy as np
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import warnings

# Suprimir warnings molestos de yfinance/pandas
warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format='%(message)s')

def get_sp500_tickers():
    """Descarga los tickers del S&P 500 desde el CSV crudo en GitHub."""
    try:
        url = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
        df = pd.read_csv(url)
        tickers = df['Symbol'].tolist()
        return [str(t).replace('.', '-') for t in tickers]
    except Exception as e:
        logging.error(f"Fallo crítico al descargar S&P 500: {e}")
        return ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL"]

def analyze_ticker_us_risk(ticker):
    try:
        # CORRECCIÓN VITAL: yf.download en lugar de yfinance.download
        df = yf.download(ticker, period="1y", progress=False, threads=False)
        
        if df.empty or len(df) < 200:
            return None

        # Aplanar MultiIndex si la versión nueva de yfinance lo devuelve así
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # Si por alguna razón la columna Close no existe (delisted), salimos
        if 'Close' not in df.columns:
            return None

        df['SMA_200'] = df['Close'].rolling(window=200).mean()
        df['High_20'] = df['High'].shift(1).rolling(window=20).max()
        df['Avg_Vol_20'] = df['Volume'].rolling(window=20).mean()
        
        df['TR'] = np.maximum(df['High'] - df['Low'],
                              np.maximum(abs(df['High'] - df['Close'].shift(1)),
                                         abs(df['Low'] - df['Close'].shift(1))))
        df['ATR_20'] = df['TR'].rolling(window=20).mean()
        df['ATR_Pct'] = (df['ATR_20'] / df['Close']) * 100

        latest = df.iloc[-1]

        # Validación de datos NaN antes de evaluar
        if pd.isna(latest['SMA_200']) or pd.isna(latest['High_20']):
            return None

        # FILTRO EXTRA: El ATR (N) debe ser menor o igual a 12.5 USD
        if (latest['Close'] > latest['SMA_200'] and 
            latest['Avg_Vol_20'] > 1_000_000 and 
            latest['Close'] >= latest['High_20'] and
            latest['ATR_20'] <= 10.00):
            
            return {
                "Ticker": ticker,
                "Close": round(float(latest['Close']), 2),
                "Breakout_Level": round(float(latest['High_20']), 2),
                "N_Value": round(float(latest['ATR_20']), 2),
                "ATR_Pct": round(float(latest['ATR_Pct']), 2)
            }
            
    except Exception as e:
        # AHORA SÍ: Si algo falla, el bot nos dice exactamente qué y dónde
        logging.error(f"[ERROR en {ticker}] -> {e}")
        
    return None

def main():
    print(f"=== ALIE Turtle Trend Screener (US - Riesgo Unitario < $12.50) ===")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
    
    tickers = get_sp500_tickers()
    candidates = []
    
    logging.info(f"Escaneando {len(tickers)} activos del S&P 500...")
    logging.info("Descargando datos históricos (esto tomará entre 10 y 30 segundos)...\n")
    
    # max_workers=10 balancea bien la velocidad sin que Yahoo Finance nos bloquee la IP
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(analyze_ticker_us_risk, tickers)
        for result in results:
            if result:
                candidates.append(result)
                
    if not candidates:
        print("\nNo se encontraron activos que cumplan los parámetros hoy.")
        return

    candidates.sort(key=lambda x: x['ATR_Pct'], reverse=True)
    top_candidates = candidates[:15]
    
    print("🔥 TOP CANDIDATOS (RIESGO CONTROLADO) 🔥")
    print("-" * 80)
    print(f"{'TICKER':<8} | {'CLOSE':<9} | {'BREAKOUT':<10} | {'N (Riesgo)':<15} | {'VOLATILIDAD (ATR%)':<15}")
    print("-" * 80)
    
    for c in top_candidates:
        print(f"{c['Ticker']:<8} | ${c['Close']:<8} | ${c['Breakout_Level']:<9} | ${c['N_Value']:<14} | {c['ATR_Pct']}%")

if __name__ == "__main__":
    main()