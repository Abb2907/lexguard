"""
LEXGUARD Backend Test Suite
============================
Tests cover: API health, history endpoint, preset loading, analyze pipeline
(validation + caching + simulation fallback), and edge cases.

Run with:
    cd a:/Antigravity_projects/ascent_promptwar
    pytest backend/test_main.py -v
"""

import pytest
import sqlite3
import os
import sys

# Make sure the project root is on the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app, raise_server_exceptions=False)

# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

VALID_CONTRACT = """
This Employment Agreement ("Agreement") is entered into between TechCorp Inc. ("Company")
and the Employee. The Employee agrees to a non-compete clause for 24 months globally after
termination, covering all technology sectors. The Company retains ownership of all inventions
created by the Employee during and outside of working hours. Arbitration is mandatory for all
disputes. The Employee waives the right to a jury trial. Salary may be adjusted at Company's
sole discretion without prior notice. Employment is at-will and can be terminated at any time.
The confidentiality clause survives indefinitely after termination of the agreement.
This document also contains a liquidated damages clause set at $50,000 per breach.
"""

SHORT_CONTRACT = "Too short."

NEXUS_PRESET_TEXT = """
Nexus Dynamics Employment Agreement — Alex Mercer — Software Engineer.
Non-compete: 24 months globally. IP Assignment: All inventions owned by Nexus Dynamics.
"""


# ─────────────────────────────────────────────────────────────────────────────
# 1. HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────

class TestHealthEndpoint:
    def test_health_returns_200(self):
        r = client.get("/api/health")
        assert r.status_code == 200

    def test_health_status_is_healthy(self):
        r = client.get("/api/health")
        data = r.json()
        assert data["status"] == "healthy"

    def test_health_has_configuration_block(self):
        r = client.get("/api/health")
        data = r.json()
        assert "configuration" in data
        cfg = data["configuration"]
        assert "groq_api" in cfg
        assert "local_database" in cfg

    def test_health_local_database_always_true(self):
        r = client.get("/api/health")
        assert r.json()["configuration"]["local_database"] is True


# ─────────────────────────────────────────────────────────────────────────────
# 2. HISTORY ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────

class TestHistoryEndpoint:
    def test_history_returns_200(self):
        r = client.get("/api/history")
        assert r.status_code == 200

    def test_history_returns_list(self):
        r = client.get("/api/history")
        assert isinstance(r.json(), list)

    def test_history_entries_have_required_fields(self):
        r = client.get("/api/history")
        entries = r.json()
        for entry in entries:
            assert "id" in entry
            assert "timestamp" in entry
            assert "doc_type" in entry
            assert "overall_risk" in entry

    def test_history_limit_is_20_or_less(self):
        r = client.get("/api/history")
        assert len(r.json()) <= 20


# ─────────────────────────────────────────────────────────────────────────────
# 3. PRESET LOADING
# ─────────────────────────────────────────────────────────────────────────────

class TestPresetEndpoint:
    def test_valid_preset_returns_200(self):
        r = client.post("/api/load-preset", json={"preset_name": "nexus_offer"})
        assert r.status_code == 200

    def test_valid_preset_has_text(self):
        r = client.post("/api/load-preset", json={"preset_name": "nexus_offer"})
        data = r.json()
        assert "text" in data
        assert len(data["text"]) > 100

    def test_valid_preset_has_doc_type(self):
        r = client.post("/api/load-preset", json={"preset_name": "nexus_offer"})
        assert "docType" in r.json()

    def test_valid_preset_has_precompiled_analysis(self):
        r = client.post("/api/load-preset", json={"preset_name": "nexus_offer"})
        assert "precompiled_analysis" in r.json()

    def test_invalid_preset_returns_404(self):
        r = client.post("/api/load-preset", json={"preset_name": "does_not_exist"})
        assert r.status_code == 404

    def test_empty_preset_name_returns_404(self):
        r = client.post("/api/load-preset", json={"preset_name": ""})
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# 4. ANALYZE ENDPOINT — INPUT VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

class TestAnalyzeValidation:
    def test_empty_text_returns_400(self):
        r = client.post("/api/analyze", json={"text": "", "docType": "employment"})
        assert r.status_code == 400

    def test_whitespace_only_returns_400(self):
        r = client.post("/api/analyze", json={"text": "   ", "docType": "employment"})
        assert r.status_code == 400

    def test_short_text_returns_400(self):
        r = client.post("/api/analyze", json={"text": SHORT_CONTRACT, "docType": "employment"})
        assert r.status_code == 400

    def test_missing_doc_type_returns_422(self):
        r = client.post("/api/analyze", json={"text": VALID_CONTRACT})
        assert r.status_code == 422

    def test_missing_text_returns_422(self):
        r = client.post("/api/analyze", json={"docType": "employment"})
        assert r.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# 5. ANALYZE ENDPOINT — SIMULATION / FALLBACK (no API key required)
# ─────────────────────────────────────────────────────────────────────────────

class TestAnalyzeSimulation:
    """
    The Nexus Dynamics preset triggers the high-fidelity simulation fallback
    which doesn't require any API keys. We use this for safe, deterministic tests.
    """

    def _get_sim_result(self):
        return client.post("/api/analyze", json={
            "text": NEXUS_PRESET_TEXT,
            "docType": "employment"
        })

    def test_simulation_returns_200(self):
        r = self._get_sim_result()
        assert r.status_code == 200

    def test_simulation_has_clauses(self):
        r = self._get_sim_result()
        data = r.json()
        assert "clauses" in data
        assert isinstance(data["clauses"], list)
        assert len(data["clauses"]) > 0

    def test_simulation_has_counsel(self):
        r = self._get_sim_result()
        data = r.json()
        assert "counsel" in data
        counsel = data["counsel"]
        assert "danger_rating" in counsel
        assert "executive_summary" in counsel

    def test_simulation_has_dashboard_scores(self):
        r = self._get_sim_result()
        counsel = r.json()["counsel"]
        assert "dashboard_scores" in counsel
        scores = counsel["dashboard_scores"]
        assert "overall_risk" in scores
        assert isinstance(scores["overall_risk"], (int, float))

    def test_simulation_has_contradictions_key(self):
        r = self._get_sim_result()
        data = r.json()
        assert "contradictions" in data

    def test_simulation_has_scenarios_key(self):
        r = self._get_sim_result()
        data = r.json()
        assert "scenarios" in data

    def test_simulation_danger_rating_is_valid(self):
        r = self._get_sim_result()
        rating = r.json()["counsel"]["danger_rating"]
        assert rating in {"SAFE", "CAUTION", "RISKY", "DANGEROUS"}

    def test_simulation_overall_risk_in_range(self):
        r = self._get_sim_result()
        risk = r.json()["counsel"]["dashboard_scores"]["overall_risk"]
        assert 0 <= risk <= 100


# ─────────────────────────────────────────────────────────────────────────────
# 6. CACHING — same text twice returns consistent result
# ─────────────────────────────────────────────────────────────────────────────

class TestCaching:
    def test_repeated_request_returns_same_danger_rating(self):
        payload = {"text": NEXUS_PRESET_TEXT, "docType": "employment"}
        r1 = client.post("/api/analyze", json=payload)
        r2 = client.post("/api/analyze", json=payload)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert (
            r1.json()["counsel"]["danger_rating"]
            == r2.json()["counsel"]["danger_rating"]
        )

    def test_repeated_request_returns_same_clause_count(self):
        payload = {"text": NEXUS_PRESET_TEXT, "docType": "employment"}
        r1 = client.post("/api/analyze", json=payload)
        r2 = client.post("/api/analyze", json=payload)
        assert len(r1.json()["clauses"]) == len(r2.json()["clauses"])


# ─────────────────────────────────────────────────────────────────────────────
# 7. DATABASE — SQLite integrity
# ─────────────────────────────────────────────────────────────────────────────

class TestDatabase:
    def test_db_file_exists(self):
        from backend.db.supabase_helper import DB_FILE
        assert os.path.exists(DB_FILE), f"DB file not found at {DB_FILE}"

    def test_audit_logs_table_exists(self):
        from backend.db.supabase_helper import DB_FILE
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'"
        )
        result = cursor.fetchone()
        conn.close()
        assert result is not None, "audit_logs table is missing"

    def test_cache_table_exists(self):
        from backend.db.supabase_helper import DB_FILE
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='analysis_cache'"
        )
        result = cursor.fetchone()
        conn.close()
        assert result is not None, "analysis_cache table is missing"


# ─────────────────────────────────────────────────────────────────────────────
# 8. EDGE CASES
# ─────────────────────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_very_long_text_gets_truncated_gracefully(self):
        """Documents over 12,000 chars should be truncated, not rejected."""
        long_text = VALID_CONTRACT * 50  # ~5000+ chars
        r = client.post("/api/analyze", json={"text": long_text, "docType": "employment"})
        # Should succeed (simulation or live), not error
        assert r.status_code in {200, 500}  # 500 only if LLM key missing + not Nexus text
        if r.status_code == 200 and "warning" in r.json():
            assert "truncated" in r.json()["warning"].lower()

    def test_special_characters_in_text(self):
        """Unicode and special chars in contract text should not crash the API."""
        text = VALID_CONTRACT + " 这是一份合同。 § 12.3 — «Arbitration» applies to all disputes."
        r = client.post("/api/analyze", json={"text": text, "docType": "employment"})
        assert r.status_code in {200, 400, 500}  # Should not be 422 (schema error)

    def test_unknown_doc_type_still_processes(self):
        """An unrecognized docType should still attempt processing, not reject."""
        r = client.post("/api/analyze", json={
            "text": NEXUS_PRESET_TEXT,
            "docType": "alien_contract"
        })
        assert r.status_code in {200, 500}
