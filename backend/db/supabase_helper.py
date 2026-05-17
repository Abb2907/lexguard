import os
import sqlite3
import json
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("lexguard.database")

# Initialize Local SQLite database as fallback
# Uses /tmp for Google Cloud Run compatibility (read-only filesystem)
DB_FILE = "/tmp/lexguard.db" if os.environ.get("K_SERVICE") else "lexguard.db"

def init_local_db():
    """Initializes local SQLite database for audit logs and caching if Supabase is unconfigured."""
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Create audit logs table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                doc_type TEXT,
                doc_length INTEGER,
                overall_risk INTEGER,
                model_used TEXT
            )
        """)
        
        # Create cache table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analysis_cache (
                id TEXT PRIMARY KEY,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                doc_type TEXT,
                doc_hash TEXT,
                analysis_results TEXT
            )
        """)
        
        conn.commit()
        conn.close()
        logger.info("Local SQLite database initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize local SQLite: {e}")

# Try loading Supabase client
_supabase_client = None
try:
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = os.getenv("SUPABASE_KEY", "").strip()
    if supabase_url and supabase_key:
        from supabase import create_client
        _supabase_client = create_client(supabase_url, supabase_key)
        logger.info("Supabase Client initialized successfully.")
except Exception as e:
    logger.warning(f"Could not load Supabase client, will use SQLite: {e}")

# Run SQLite setup on import
init_local_db()

def log_analysis(doc_type: str, doc_length: int, overall_risk: int, model_used: str):
    """Logs metadata of analyses conducted (never the actual private contract content for privacy)."""
    # Supabase try
    if _supabase_client:
        try:
            _supabase_client.table("audit_logs").insert({
                "doc_type": doc_type,
                "doc_length": doc_length,
                "overall_risk": overall_risk,
                "model_used": model_used
            }).execute()
            logger.info("Analysis audit logged to Supabase.")
            return
        except Exception as e:
            logger.error(f"Supabase audit logging failed: {e}. Falling back to SQLite.")

    # SQLite fallback
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO audit_logs (doc_type, doc_length, overall_risk, model_used) VALUES (?, ?, ?, ?)",
            (doc_type, doc_length, overall_risk, model_used)
        )
        conn.commit()
        conn.close()
        logger.info("Analysis audit logged to local SQLite.")
    except Exception as e:
        logger.error(f"SQLite audit logging failed: {e}")

def get_cached_analysis(doc_hash: str, doc_type: str) -> Optional[Dict[str, Any]]:
    """Checks if this identical contract has already been analyzed to save API tokens."""
    # Supabase try
    if _supabase_client:
        try:
            response = _supabase_client.table("analysis_cache").select("analysis_results").eq("doc_hash", doc_hash).eq("doc_type", doc_type).execute()
            if response.data:
                logger.info("Cache hit in Supabase!")
                return json.loads(response.data[0]["analysis_results"])
        except Exception as e:
            logger.error(f"Supabase cache retrieval failed: {e}")

    # SQLite fallback
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT analysis_results FROM analysis_cache WHERE doc_hash = ? AND doc_type = ?", (doc_hash, doc_type))
        row = cursor.fetchone()
        conn.close()
        if row:
            logger.info("Cache hit in SQLite!")
            return json.loads(row[0])
    except Exception as e:
        logger.error(f"SQLite cache retrieval failed: {e}")
        
    return None

def set_cached_analysis(doc_hash: str, doc_type: str, analysis_results: Dict[str, Any]):
    """Caches analysis results for future identical runs."""
    results_str = json.dumps(analysis_results)
    
    # Supabase try
    if _supabase_client:
        try:
            _supabase_client.table("analysis_cache").upsert({
                "doc_hash": doc_hash,
                "doc_type": doc_type,
                "analysis_results": results_str
            }).execute()
            logger.info("Analysis cached to Supabase.")
            return
        except Exception as e:
            logger.error(f"Supabase cache saving failed: {e}")

    # SQLite fallback
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO analysis_cache (id, doc_type, doc_hash, analysis_results) VALUES (?, ?, ?, ?)",
            (f"{doc_type}_{doc_hash}", doc_type, doc_hash, results_str)
        )
        conn.commit()
        conn.close()
        logger.info("Analysis cached to SQLite.")
    except Exception as e:
        logger.error(f"SQLite cache saving failed: {e}")
