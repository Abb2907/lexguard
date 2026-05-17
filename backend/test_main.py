import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "db_connected" in data

def test_agent_registry():
    response = client.get("/api/agents")
    assert response.status_code == 200
    data = response.json()
    assert "extractor" in data
    assert "analyst" in data
    assert "scenario" in data

def test_load_preset_valid():
    response = client.post("/api/load-preset", json={"preset_name": "Nexus Dynamics Offer Letter"})
    assert response.status_code == 200
    data = response.json()
    assert "contract_text" in data
    assert "Nexus" in data["contract_text"]

def test_load_preset_invalid():
    response = client.post("/api/load-preset", json={"preset_name": "Nonexistent"})
    assert response.status_code == 404
