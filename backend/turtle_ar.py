import yfinance as yf
import pandas as pd
import numpy as np
import logging
import requests
import urllib3
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import warnings

# Suprimir warnings SSL por el verify=False de BYMA y los internos de pandas
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format='%(message)s')

def get_merval_lider_tickers():
    """Obtiene dinámicamente el Panel Líder desde la API de BYMA."""
    try:
        logging.info("Conectando a BYMA para obtener el Panel Líder actualizado...")
        url = "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/leading-equity"
        payload = {
            "excludeZeroPxAndQty": False,
            "T0": False,
            "T1": True,
            "T2": False,
            "Content-Type": "application/json"
        }
        
        # Usamos json=payload para que requests setee los headers automáticamente
        response = requests.post(url, json=payload, verify=False, timeout=10)
        response.raise_for_status()
        data = response.json().get("data", [])
        
        tickers = []
        for item in data:
            symbol = item.get("symbol")
            if symbol:
                # yfinance requiere el sufijo .BA para acciones argentinas
                tickers.append(f"{symbol}.BA")
                
        logging.info(f"Panel Líder obtenido: {len(tickers)} activos detectados.")
        return tickers
        
    except Exception as e:
        logging.error(f"Fallo al contactar API de BYMA: {e}")
        # Fallback a la lista dura en caso de que la infraestructura de BYMA esté caída
        return None

def analyze_ticker_merval(ticker):
    try:
        df = yf.download(ticker, period="1y", progress=False, threads=False)
        
        if df.empty or len(df) < 200:
            return None

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
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

        if pd.isna(latest['SMA_200']) or pd.isna(latest['High_20']):
            return None

        # Filtro: Tendencia alcista, Volumen local aceptable y Breakout
        if (latest['Close'] > latest['SMA_200'] and 
            latest['Avg_Vol_20'] > 50_000 and 
            latest['Close'] >= latest['High_20']):
            
            return {
                "Ticker": ticker.replace('.BA', ''),
                "Close": round(float(latest['Close']), 2),
                "Breakout_Level": round(float(latest['High_20']), 2),
                "SMA_200": round(float(latest['SMA_200']), 2),
                "N_Value": round(float(latest['ATR_20']), 2),
                "ATR_Pct": round(float(latest['ATR_Pct']), 2)
            }
            
    except Exception as e:
        logging.error(f"[ERROR en {ticker}] -> {e}")
        
    return None

def main():
    print(f"=== ALIE Turtle Trend Screener (MERVAL - PANEL LÍDER BYMA) ===")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
    
    tickers = get_merval_lider_tickers()
    if not tickers:
        return
        
    candidates = []
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(analyze_ticker_merval, tickers)
        for result in results:
            if result:
                candidates.append(result)
                
    if not candidates:
        print("\nSin señales en el Merval hoy. Las Tortugas esperan.")
        return

    candidates.sort(key=lambda x: x['ATR_Pct'], reverse=True)
    
    print("\n🔥 CANDIDATOS PANEL LÍDER (ARS) 🔥")
    print("-" * 85)
    print(f"{'TICKER':<10} | {'CLOSE':<12} | {'BREAKOUT LVL':<12} | {'SMA 200':<12} | {'N (ARS)':<12} | {'VOLAT (ATR%)':<12}")
    print("-" * 85)
    
    for c in candidates:
        print(f"{c['Ticker']:<10} | ${c['Close']:<11} | ${c['Breakout_Level']:<11} | ${c['SMA_200']:<11} | ${c['N_Value']:<11} | {c['ATR_Pct']}%")
        
    print("-" * 85)
    print("\nNota de Gestión de Riesgo:")
    print("El valor 'N' está expresado en ARS. Recuerda ajustar tu tope máximo de pérdida por trade")
    print("convirtiendo tu límite en dólares utilizando el tipo de cambio CCL actual.")

if __name__ == "__main__":
    main()