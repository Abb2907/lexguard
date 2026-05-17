from typing import List, Dict, Any
from backend.llm.router import call_llm

EXTRACTOR_PROMPT = """You are a legal clause extraction specialist. Given a legal document, extract
every significant clause. For each clause output:
- id: sequential identifier (c1, c2, ...)
- type: one of [LIABILITY | TERMINATION | PAYMENT | DATA_PRIVACY | ARBITRATION |
  INDEMNIFICATION | IP_OWNERSHIP | AUTO_RENEWAL | JURISDICTION | NON_COMPETE |
  FORCE_MAJEURE | AMENDMENT | COMPLIANCE | PENALTY | REFUND | EXCLUSIVITY | OTHER]
- original_text: verbatim clause text
- benefits_party: DRAFTER | SIGNER | NEUTRAL
- location_hint: approximate document location (e.g., "Section 3", "Page 2")

Document category: {doc_type}
Output ONLY a valid JSON array. No preamble. No markdown. No explanation."""

async def run_extractor(document_text: str, doc_type: str) -> List[Dict[str, Any]]:
    """Runs the Extractor agent (Agent 1) using Groq llama-3.1-8b-instant."""
    system_prompt = EXTRACTOR_PROMPT.format(doc_type=doc_type)
    
    # We call the fast extraction model
    result = await call_llm(
        system_prompt=system_prompt,
        user_content=document_text,
        task_type="extraction",
        temperature=0.1
    )
    
    if isinstance(result, list):
        return result
    elif isinstance(result, dict) and "clauses" in result:
        return result["clauses"]
    else:
        raise ValueError("Invalid output format from Extractor Agent.")
