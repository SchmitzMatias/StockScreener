import pandas as pd
import logging
import datetime
from typing import List, Dict, Any

from data_loader import get_ticker_fundamentals

logger = logging.getLogger(__name__)

def calculate_atr(df_stacked: pd.DataFrame, periods: int = 14) -> pd.Series:
    """
    Calcula el Average True Range (ATR) usando pandas puro de manera vectorizada
    sobre un DataFrame apilado (MultiIndex Date, Ticker).
    """
    logger.debug("Calculando ATR (Average True Range)...")
    grouped = df_stacked.groupby(level='Ticker')
    
    # 1. TR1 = High - Low
    tr1 = df_stacked['High'] - df_stacked['Low']
    
    # 2. TR2 = abs(High - Previous Close)
    prev_close = grouped['Close'].shift(1)
    tr2 = (df_stacked['High'] - prev_close).abs()
    
    # 3. TR3 = abs(Low - Previous Close)
    tr3 = (df_stacked['Low'] - prev_close).abs()
    
    # True Range = max(TR1, TR2, TR3)
    # Como tenemos Series, pd.concat y max a través del eje horizontal es muy veloz
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    # ATR = RMA(TR) (suavizado exponencial con alpha=1/periods)
    atr = tr.groupby(level='Ticker').transform(
        lambda x: x.ewm(alpha=1/periods, adjust=False, min_periods=periods).mean()
    )
    
    return atr

def apply_fundamental_filters_and_score(tickers: List[str], df_processed: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Paso 1: Aplica filtros fundamentales (Hard Filters) (Earnings, currentRatio, trailingEps, Net Income).
    Paso 2: Calcula el algoritmo 'Bounce Score' (0 a 100) ponderando Z-Score, Vol Climático y Deuda.
    Paso 3: Gestión de riesgo (Target_FrontRun y Stop_Loss_Sugerido usando ATR).
    Paso 4: Devuelve los top 5 resultados ordenados.
    """
    if not tickers:
        logger.info("No hay tickers para evaluar en la fase de scoring.")
        return []
        
    logger.info(f"Evaluando {len(tickers)} tickers con fundamentales y scoring...")
    
    # Pre-calcular ATR en el DataFrame completo 
    df_processed['ATR_14'] = calculate_atr(df_processed, periods=14)
    
    # Nos quedamos con el último registro para cada ticker
    df_reset = df_processed.reset_index()
    last_day_df = df_reset.groupby('Ticker').last()
    
    results = []
    
    for ticker in tickers:
        # Extraer fundamentales
        fundamentals = get_ticker_fundamentals(ticker)
        info = fundamentals.get('info') or {}
        next_earnings = fundamentals.get('next_earnings_date')
        
        # --- PASO 1: Hard Filters Fundamentales ---
        
        # 1. Earnings en próximos 15 días
        if next_earnings:
            try:
                # Convertimos a timestamp aware si es necesario
                if isinstance(next_earnings, (int, float)):
                    earnings_dt = pd.to_datetime(next_earnings, unit='s')
                else:
                    earnings_dt = pd.to_datetime(next_earnings)
                
                now = pd.Timestamp.now(tz=earnings_dt.tzinfo if earnings_dt.tzinfo else None)
                days_to_earnings = (earnings_dt - now).days
                
                if 0 <= days_to_earnings <= 15:
                    logger.debug(f"[{ticker}] Descartado: Earnings muy próximos ({days_to_earnings} días).")
                    continue
            except Exception as e:
                logger.warning(f"[{ticker}] Error al procesar fecha de earnings: {e}")
                
        # 2. currentRatio < 1.0
        current_ratio = info.get('currentRatio')
        if current_ratio is not None and current_ratio < 1.0:
            logger.debug(f"[{ticker}] Descartado: currentRatio ({current_ratio}) < 1.0")
            continue
            
        # 3. trailingEps o Net Income negativos
        trailing_eps = info.get('trailingEps')
        net_income = info.get('netIncomeToCommon')
        if trailing_eps is not None and trailing_eps < 0:
            logger.debug(f"[{ticker}] Descartado: trailingEps ({trailing_eps}) negativo.")
            continue
        if net_income is not None and net_income < 0:
            logger.debug(f"[{ticker}] Descartado: Net Income ({net_income}) negativo.")
            continue
            
        # --- PASO 2 y 3: Scoring y Riesgo ---
        
        if ticker not in last_day_df.index:
            continue
            
        t_data = last_day_df.loc[ticker]
        z_score = t_data['Z_Score']
        vol_climatico = t_data['Volumen_Climatico']
        sma_20 = t_data['SMA_20']
        close_price = t_data['Close']
        atr = t_data['ATR_14']
        rsi = t_data['RSI_14']
        
        score = 0.0
        
        # Puntuación Z-Score (hasta 75 puntos)
        if not pd.isna(z_score):
            if z_score <= -3:
                score += 75
            elif z_score < 0:
                score += (-z_score / 3.0) * 75
                
        # Bono de Volumen Climático (15 puntos)
        if vol_climatico:
            score += 15
            
        # Bono de Deuda (10 puntos)
        debt_to_equity = info.get('debtToEquity')
        if debt_to_equity is not None and debt_to_equity < 100:
            score += 10
            
        # Cap a 100
        score = min(score, 100.0)
        
        # Gestión de Riesgo (Target y Stop Loss)
        target = sma_20 * 0.98
        stop_loss = close_price - (1.5 * atr)
        
        results.append({
            'Ticker': ticker,
            'Price': round(close_price, 2) if not pd.isna(close_price) else None,
            'RSI': round(rsi, 2) if not pd.isna(rsi) else None,
            'Z-Score': round(z_score, 2) if not pd.isna(z_score) else None,
            'Bounce_Score': round(score, 2),
            'Target_FrontRun': round(target, 2) if not pd.isna(target) else None,
            'Stop_Loss_Sugerido': round(stop_loss, 2) if not pd.isna(stop_loss) else None
        })
        
    # --- PASO 4: Ordenamiento final ---
    # Ordenamos por Bounce Score descendente
    results_sorted = sorted(results, key=lambda x: x['Bounce_Score'], reverse=True)
    
    logger.info(f"{len(results_sorted)} tickers superaron todas las pruebas.")
    
    # Retornamos solo el Top 5
    return results_sorted[:5]
