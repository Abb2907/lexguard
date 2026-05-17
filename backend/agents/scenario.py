import json
from typing import List, Dict, Any
from backend.llm.router import call_llm

SCENARIO_PROMPT = """You are a real-world legal impact simulator working to protect the signer.
For each high-risk clause, generate exactly 2–3 concrete scenarios showing how this clause
could realistically be used against the signer.

Scenarios must be:
- Specific: include roles, dollar amounts, timeframes where relevant
- Realistic: plausible in everyday professional or consumer contexts
- Plain language: understandable by a non-lawyer
- Alarming where warranted: do not soften genuine dangers

Document category: {doc_type}

Output MUST match this JSON structure:
[
  {{
    "clause_id": "c1",
    "scenarios": [
      "Scenario 1 details...",
      "Scenario 2 details...",
      "Scenario 3 details..."
    ]
  }}
]
Output ONLY valid JSON. No markdown."""

async def run_scenario(analyzed_clauses: List[Dict[str, Any]], doc_type: str) -> List[Dict[str, Any]]:
    """Runs the Scenario Engine agent (Agent 4) using llama-3.3-70b-versatile."""
    # Filter high-risk clauses (risk_score >= 6) per tokens optimization
    high_risk_clauses = [c for c in analyzed_clauses if c.get("risk_score", 0) >= 6]
    
    if not high_risk_clauses:
        # Graceful degradation if no high-risk clauses found
        return []
        
    compressed_clauses = [
        {
            "id": c["id"],
            "type": c["type"],
            "original_text": c["original_text"],
            "plain_english_meaning": c.get("plain_english_meaning", ""),
            "risk_score": c.get("risk_score")
        } for c in high_risk_clauses
    ]
    
    system_prompt = SCENARIO_PROMPT.format(doc_type=doc_type)
    user_content = json.dumps(compressed_clauses)
    
    result = await call_llm(
        system_prompt=system_prompt,
        user_content=user_content,
        task_type="reasoning",
        temperature=0.3
    )
    
    if isinstance(result, list):
        return result
    else:
        # Try finding it in dict
        if isinstance(result, dict) and "scenarios" in result:
            return result["scenarios"]
        return []
