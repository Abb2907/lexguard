import json
from typing import List, Dict, Any
from backend.llm.router import call_llm
from backend.db.chroma_helper import query_benchmark_standards

CONTRADICTION_PROMPT = """You are a legal consistency auditor and industry standards expert.
Given analyzed clauses, perform two tasks:

TASK A — CONTRADICTION DETECTION:
Find clause pairs or groups that contradict each other, create circular
obligations, or produce ambiguous outcomes when read together.

TASK B — BENCHMARK COMPARISON:
Compare each clause with risk_score >= 5 against typical fair-market
standards for this document category. Classify each as:
- STANDARD: common and expected in this document type
- AGGRESSIVE: more one-sided than typical industry practice
- UNUSUAL: rarely seen; warrants extra scrutiny
- POTENTIALLY_UNENFORCEABLE: likely to fail legal challenge

Document category: {doc_type}

Output MUST match this JSON structure:
{{
  "contradictions": [
    {{
      "clause_ids": ["c1", "c4"],
      "description": "Conflict description...",
      "severity": "HIGH | MEDIUM | LOW",
      "implication": "Signer implication..."
    }}
  ],
  "benchmark_comparisons": [
    {{
      "clause_id": "c1",
      "classification": "AGGRESSIVE",
      "industry_standard": "Industry baseline...",
      "industry_note": "Comparison details..."
    }}
  ]
}}
Output ONLY valid JSON. No markdown."""

async def run_contradiction(analyzed_clauses: List[Dict[str, Any]], doc_type: str) -> Dict[str, Any]:
    """Runs the Contradiction & Benchmark Detector agent (Agent 3) using mixtral-8x7b-32768."""
    # To save tokens, we do selectively pass only key details: id, type, original_text, benefits_party, risk_score
    compressed_clauses = [
        {
            "id": c["id"],
            "type": c["type"],
            "original_text": c["original_text"],
            "benefits_party": c["benefits_party"],
            "risk_score": c.get("risk_score", 5)
        } for c in analyzed_clauses
    ]
    
    system_prompt = CONTRADICTION_PROMPT.format(doc_type=doc_type)
    user_content = json.dumps(compressed_clauses)
    
    # Trigger LLM call
    result = await call_llm(
        system_prompt=system_prompt,
        user_content=user_content,
        task_type="structured",
        temperature=0.1
    )
    
    # Fallback structure if LLM output is missing required fields
    if not isinstance(result, dict):
        result = {"contradictions": [], "benchmark_comparisons": []}
        
    if "contradictions" not in result:
        result["contradictions"] = []
    if "benchmark_comparisons" not in result:
        result["benchmark_comparisons"] = []
        
    # Supplement using ChromaDB / local semantic search for high-risk clauses
    seen_benchmark_ids = {b["clause_id"] for b in result["benchmark_comparisons"]}
    for clause in analyzed_clauses:
        c_id = clause["id"]
        # If risk_score is high and it wasn't analyzed by the LLM benchmark, or to ensure database verify
        if clause.get("risk_score", 0) >= 5 and c_id not in seen_benchmark_ids:
            try:
                local_bench = query_benchmark_standards(
                    clause_text=clause["original_text"],
                    clause_type=clause["type"],
                    doc_category=doc_type
                )
                result["benchmark_comparisons"].append({
                    "clause_id": c_id,
                    "classification": local_bench["classification"],
                    "industry_standard": local_bench["industry_standard"],
                    "industry_note": local_bench["industry_note"]
                })
            except Exception as e:
                # Log and proceed
                pass
                
    return result
