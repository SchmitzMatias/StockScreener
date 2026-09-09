import pandas as pd
import logging
from typing import List

logger = logging.getLogger(__name__)

def calculate_rsi(series: pd.Series, periods: int = 14) -> pd.Series:
    """
    Calcula el RSI usando la media móvil exponencial de Wilder (RMA), 
    que es exactamente el mismo algoritmo que usa pandas-ta por defecto.
    """
    delta = series.diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    
    # Wilder's smoothing (RMA) usa ewm con alpha=1/periods
    avg_gain = gain.ewm(alpha=1/periods, adjust=False, min_periods=periods).mean()
    avg_loss = loss.ewm(alpha=1/periods, adjust=False, min_periods=periods).mean()
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def process_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Toma un DataFrame de precios históricos descargado en modo batch desde yfinance
    y calcula indicadores técnicos de forma completamente vectorizada usando pandas puro.
    """
    logger.info("Procesando indicadores técnicos con pandas nativo...")
    
    if df.empty:
        return pd.DataFrame()
        
    # Verificar si el DataFrame tiene un MultiIndex en las columnas (típico de yf.download en batch)
    if isinstance(df.columns, pd.MultiIndex):
        try:
            df_stacked = df.stack(level=0, future_stack=True)
        except TypeError:
            df_stacked = df.stack(level=0)
    else:
        df_stacked = df.copy()
        df_stacked['Ticker'] = 'UNKNOWN'
        df_stacked = df_stacked.set_index('Ticker', append=True)

    if df_stacked.index.names[1] is None or df_stacked.index.names[1] != 'Ticker':
        df_stacked.index.names = ['Date', 'Ticker']
        
    # Agrupamos por Ticker
    grouped = df_stacked.groupby(level='Ticker')
    
    # 1. SMA 20 y SMA 200
    df_stacked['SMA_20'] = grouped['Close'].transform(lambda x: x.rolling(20).mean())
    df_stacked['SMA_200'] = grouped['Close'].transform(lambda x: x.rolling(200).mean())
    
    # 2. RSI de 14 períodos
    df_stacked['RSI_14'] = grouped['Close'].transform(lambda x: calculate_rsi(x, periods=14))
    
    # 3. Volatilidad (Desviación estándar de 20 días del cierre)
    df_stacked['Volatilidad_20'] = grouped['Close'].transform(lambda x: x.rolling(20).std())
    
    # 4. Z-Score del Precio: (Precio - SMA_20) / Volatilidad
    df_stacked['Z_Score'] = (df_stacked['Close'] - df_stacked['SMA_20']) / df_stacked['Volatilidad_20']
    
    # 5. Volumen Climático (> 150% de la media de 20 días de volumen)
    sma_vol_20 = grouped['Volume'].transform(lambda x: x.rolling(20).mean())
    df_stacked['Volumen_Climatico'] = df_stacked['Volume'] > (sma_vol_20 * 1.5)
    
    logger.info("Cálculo de indicadores técnicos completado.")
    return df_stacked

def filter_base_technical(df_processed: pd.DataFrame) -> List[str]:
    """
    Filtra los tickers que cumplan las condiciones base en su último día cotizado:
    - Precio de cierre por debajo de la SMA_20.
    - Precio de cierre por debajo de la SMA_200.
    - RSI menor a 50.
    """
    logger.info("Aplicando filtro técnico base...")
    
    if df_processed.empty:
        return []
        
    df_reset = df_processed.reset_index()
    last_day_df = df_reset.groupby('Ticker').last()
    
    # Condiciones base para Swing Trading de reversión a la media
    cond_sma_20 = last_day_df['Close'] < last_day_df['SMA_20']
    cond_sma_200 = last_day_df['Close'] < last_day_df['SMA_200']
    cond_rsi = last_day_df['RSI_14'] < 50
    
    filtered_df = last_day_df[cond_sma_20 & cond_sma_200 & cond_rsi]
    
    tickers_cumplen = filtered_df.index.tolist()
    logger.info(f"{len(tickers_cumplen)} tickers cumplieron el filtro base técnico.")
    
    return tickers_cumplen
