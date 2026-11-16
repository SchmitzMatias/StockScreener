import json
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# --- CONFIGURACIÓN ---
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def migrate_metadata():
    print("Migrando market_metadata...")
    try:
        meta_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'meta.json')
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)
        
        data = {
            "id": 1,
            "last_run": meta.get("last_run"),
            "vix_price": meta.get("vix_price"),
            "vix_change": meta.get("vix_change"),
            "sma20_bull_pct": meta.get("sma20_bull_pct"),
            "spy_price": meta.get("spy_price"),
            "spy_change": meta.get("spy_change"),
            "spy_history": meta.get("spy_history", [])
        }
        
        supabase.table('market_metadata').upsert(data).execute()
        print("✅ Metadata migrada.")
    except Exception as e:
        print(f"⚠️ Error en metadata: {e}")

def migrate_candidates():
    print("Migrando screener_candidates (desde history.json)...")
    try:
        history_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'history.json')
        with open(history_path, 'r', encoding='utf-8') as f:
            history_data = json.load(f)
            
        # history.json tiene las fechas como claves principales
        for date_key, candidates in history_data.items():
            for c in candidates:
                candidate_data = {
                    "created_at": date_key,
                    "ticker": c.get("Ticker"),
                    "strategy": "kotegawa", 
                    "close_price": c.get("Price"),
                    "score": c.get("Bounce_Score"),
                    "target": c.get("Target_FrontRun"),
                    "stop_loss": c.get("Stop_Loss_Sugerido"),
                    "strategy_props": {
                        "rsi": c.get("RSI"),
                        "z_score": c.get("Z-Score")
                    }
                }
                supabase.table('screener_candidates').insert(candidate_data).execute()
        print("✅ Candidatos del screener migrados con éxito.")
    except Exception as e:
        print(f"⚠️ Error en candidatos: {e}")

def migrate_trades():
    print("Migrando trades (desde Backtest.json)...")
    try:
        backtest_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'backtest.json')
        with open(backtest_path, 'r', encoding='utf-8') as f:
            backtest_data = json.load(f)
            
        for t in backtest_data:
            is_closed = t.get("Exit_Reason") is not None
            status = 'CLOSED' if is_closed else 'OPEN'
            
            trade_data = {
                "ticker": t.get("Ticker"),
                "strategy": "kotegawa",
                "taken": False, # Mocks teóricos por defecto
                "entry_date": t.get("Entry_Date"),
                "entry_price": t.get("Entry_Price"),
                "target": t.get("Target"),
                "stop_loss": t.get("Stop_Loss"),
                "status": status,
                "exit_date": t.get("Exit_Date") if is_closed else None,
                "exit_price": t.get("Exit_Price") if is_closed else None,
                "exit_reason": t.get("Exit_Reason"),
                "pnl_percent": t.get("PnL_Percent"), # Corrección de clave
                "days_held": t.get("Days_Held"),
                "strategy_props": {} # Kotegawa no necesita guardar estado complejo aquí
            }
            supabase.table('trades').insert(trade_data).execute()
        print(f"✅ {len(backtest_data)} trades migrados con éxito.")
    except Exception as e:
        print(f"⚠️ Error en trades: {e}")

if __name__ == "__main__":
    print("Iniciando migración a Supabase...")
    migrate_metadata()
    migrate_candidates()
    migrate_trades()
    print("🚀 Migración completada.")