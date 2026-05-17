import json
from typing import List, Dict, Any
from backend.llm.router import call_llm

RISK_ANALYST_PROMPT = """You are an adversarial contract risk analyst. You work EXCLUSIVELY to protect
the signing party, never the drafter. Analyze each extracted clause and add:
- risk_score: 1–10 (10 = maximally dangerous to signer)
- exploitation_score: 1–10 (how much this unfairly favors the drafter)
- ambiguity_score: 1–10 (how vague or undefined key terms are)
- risk_type: primary risk category
- enforceability_concern: boolean
- enforceability_note: string explanation of enforceability if concern is true, otherwise empty
- hidden_liabilities: array of non-obvious obligations on the signer
- red_flags: array of specific plain-language concerns
- plain_english_meaning: what this clause actually means for the signer

Flag clauses that appear benign but carry hidden risk.
Document category: {doc_type}
Output ONLY a valid JSON array extending each clause object with the keys above. No markdown."""

async def run_analyst(extracted_clauses: List[Dict[str, Any]], doc_type: str) -> List[Dict[str, Any]]:
    """Runs the Risk Analyst agent (Agent 2) using llama-3.3-70b-versatile."""
    system_prompt = RISK_ANALYST_PROMPT.format(doc_type=doc_type)
    user_content = json.dumps(extracted_clauses)
    
    result = await call_llm(
        system_prompt=system_prompt,
        user_content=user_content,
        task_type="reasoning",
        temperature=0.2
    )
    
    if isinstance(result, list):
        return result
    elif isinstance(result, dict) and "clauses" in result:
        return result["clauses"]
    else:
        raise ValueError("Invalid output format from Risk Analyst Agent.")
