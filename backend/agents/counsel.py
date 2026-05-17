import json
from typing import Dict, Any
from backend.llm.router import call_llm

COUNSEL_PROMPT = """You are a user-rights advocate and legal communication specialist.
Given the full analysis pipeline output (extracted clauses, risk scores,
contradictions, benchmark comparisons, scenarios), produce a final advisory report.

You must output ONLY valid JSON matching this exact schema:
{{
  "danger_rating": "SAFE | CAUTION | RISKY | DANGEROUS",
  "danger_summary": "one sentence explanation",
  "overall_power_balance": "BALANCED | SLIGHTLY_UNEVEN | HEAVILY_ONE_SIDED",
  "recommended_action": "SIGN | NEGOTIATE | SEEK_LEGAL_REVIEW | DO_NOT_SIGN",
  "executive_summary": "2-3 paragraph plain-language description of what the signer is agreeing to",
  "dashboard_scores": {{
    "overall_risk": 0-100,
    "fairness_score": 0-100,
    "privacy_risk": 0-100,
    "financial_exposure": 0-100,
    "ambiguity_score": 0-100,
    "exploitability_index": 0-100
  }},
  "top_concerns": [
    {{
      "rank": 1,
      "clause_id": "c1",
      "concern": "plain language description of the risk",
      "negotiation_language": "exact suggested replacement or addendum text",
      "walk_away_threshold": true
    }}
  ],
  "privacy_compliance_flags": [
    "Possible GDPR Article 6 violation: no explicit consent basis stated for data sharing"
  ],
  "questions_to_ask": [
    "Can we add a personal-project carve-out to the IP assignment clause?"
  ]
}}

Output ONLY valid JSON. No markdown. No preamble."""

async def run_counsel(pipeline_context: Dict[str, Any]) -> Dict[str, Any]:
    """Runs the Counsel Advisor agent (Agent 5) using llama-3.3-70b-versatile."""
    # Compress context to ensure token compliance
    compressed_high_risk = []
    for c in pipeline_context.get("high_risk_clauses", []):
        compressed_high_risk.append({
            "id": c["id"],
            "type": c["type"],
            "plain_english_meaning": c.get("plain_english_meaning", ""),
            "risk_score": c.get("risk_score", 5),
            "red_flags": c.get("red_flags", [])[:2] # Top 2 flags
        })
        
    compressed_context = {
        "docType": pipeline_context.get("docType", "General"),
        "high_risk_clauses": compressed_high_risk,
        "contradiction_count": pipeline_context.get("contradiction_count", 0),
        "contradictions": pipeline_context.get("contradictions", [])[:3], # Top 3
        "benchmark_flags": [
            b for b in pipeline_context.get("benchmark_flags", [])
            if b.get("classification") != "STANDARD"
        ][:4], # Top 4
        "scenarios": pipeline_context.get("scenarios", [])[:4] # Top 4
    }
    
    user_content = json.dumps(compressed_context)
    
    result = await call_llm(
        system_prompt=COUNSEL_PROMPT,
        user_content=user_content,
        task_type="reasoning",
        temperature=0.2
    )
    
    if isinstance(result, dict):
        return result
    else:
        raise ValueError("Invalid output format from Counsel Advisor Agent.")
