import yfinance as yf
import pandas as pd
import numpy as np
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

# Configure logging to show progress cleanly
logging.basicConfig(level=logging.INFO, format='%(message)s')

def get_nasdaq_100_tickers():
    """Fetches the current NASDAQ 100 tickers from Wikipedia."""
    try:
        logging.info("Fetching QQQ tickers from Wikipedia...")
        # Table 4 usually contains the constituents on this specific wiki page
        wiki_url = 'https://en.wikipedia.org/wiki/Nasdaq-100'
        tables = pd.read_html(wiki_url)
        df_tickers = tables[4]
        tickers = df_tickers['Ticker'].tolist()
        # Clean up any potential formatting issues
        tickers = [t.replace('.', '-') for t in tickers]
        return tickers
    except Exception as e:
        logging.warning(f"Could not fetch from Wikipedia ({e}). Using robust fallback list.")
        # Fallback list of major QQQ components
        return ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "GOOG", "TSLA", "AVGO", "PEP", 
                "COST", "CSCO", "TMUS", "ADBE", "TXN", "CMCSA", "AMD", "NFLX", "QCOM", "INTC"]

def analyze_ticker(ticker):
    """Downloads data and applies the Turtle / Finviz breakout logic."""
    try:
        # Download 1 year of data to ensure we have enough for the 200 SMA
        df = yf.download(ticker, period="1y", progress=False)
        
        if len(df) < 200:
            return None # Not enough history

        # Flatten columns if yfinance returns a MultiIndex (recent yfinance versions do this)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        # 1. Calculate Trend (SMA 200)
        df['SMA_200'] = df['Close'].rolling(window=200).mean()
        
        # 2. Calculate Turtle Entry Channel (Highest High of past 20 days, excluding today)
        df['High_20'] = df['High'].shift(1).rolling(window=20).max()
        
        # 3. Calculate Liquidity (20-day Average Volume)
        df['Avg_Vol_20'] = df['Volume'].rolling(window=20).mean()
        
        # 4. Calculate ATR (20) for Volatility ranking
        df['TR'] = np.maximum(df['High'] - df['Low'],
                              np.maximum(abs(df['High'] - df['Close'].shift(1)),
                                         abs(df['Low'] - df['Close'].shift(1))))
        df['ATR_20'] = df['TR'].rolling(window=20).mean()
        df['ATR_Pct'] = (df['ATR_20'] / df['Close']) * 100 # ATR as a % of price

        # Get the most recent day's data
        latest = df.iloc[-1]

        # Apply the logic:
        # - Close must be ABOVE the 200 SMA (Uptrend)
        # - Volume must be > 1M (Liquidity)
        # - Close must be breaking out above the 20-day high (Turtle Trigger)
        if (latest['Close'] > latest['SMA_200'] and 
            latest['Avg_Vol_20'] > 1_000_000 and 
            latest['Close'] >= latest['High_20']):
            
            return {
                "Ticker": ticker,
                "Close": round(latest['Close'], 2),
                "Breakout_Level": round(latest['High_20'], 2),
                "SMA_200": round(latest['SMA_200'], 2),
                "ATR_Pct": round(latest['ATR_Pct'], 2), # Used to proxy the Beta > 1.5 / Vol > 3% filter
                "N_Value": round(latest['ATR_20'], 2)   # Your 'n' from PineScript for SL math
            }
            
    except Exception:
        pass # Silently skip errors (like delisted tickers)
        
    return None

def main():
    print(f"=== ALIE Turtle Trend Screener (QQQ) ===")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
    
    tickers = get_nasdaq_100_tickers()
    candidates = []
    
    logging.info(f"Scanning {len(tickers)} tickers for 20-Day Breakouts > SMA200...")
    
    # Use ThreadPoolExecutor to scan concurrently (much faster than a simple loop)
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(analyze_ticker, tickers)
        
        for result in results:
            if result:
                candidates.append(result)
                
    if not candidates:
        print("\nNo setups found today. The Turtles stay flat.")
        return

    # Sort candidates by ATR % (Volatility) descending to find the most explosive setups
    candidates.sort(key=lambda x: x['ATR_Pct'], reverse=True)
    
    # Get top 10
    top_candidates = candidates[:10]
    
    print("\n🔥 TOP TURTLE BREAKOUT CANDIDATES 🔥")
    print("-" * 75)
    print(f"{'TICKER':<10} | {'CLOSE':<10} | {'BREAKOUT LVL':<12} | {'SMA 200':<10} | {'VOLATILITY (ATR%)':<15}")
    print("-" * 75)
    
    for c in top_candidates:
        print(f"{c['Ticker']:<10} | ${c['Close']:<9} | ${c['Breakout_Level']:<11} | ${c['SMA_200']:<9} | {c['ATR_Pct']}%")
        
    print("-" * 75)
    print("\nStrategy Note:")
    print("If entering these setups, initial Stop Loss is usually 2 * N_Value below the Close.")

if __name__ == "__main__":
    main()