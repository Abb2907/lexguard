import logging
import math
import re
from typing import List, Dict, Any, Optional

logger = logging.getLogger("lexguard.chroma")

# Preloaded fair-market standards for comparison (injected when ChromaDB is queried)
BENCHMARK_PRESETS = {
    "Employment / Offer Letter": [
        {
            "clause_type": "IP_OWNERSHIP",
            "standard_text": "All intellectual property created during the performance of duties and during standard working hours belongs to the company. However, the Employee retains full ownership of any works created outside working hours using personal equipment, without company resources or trade secrets.",
            "classification": "STANDARD",
            "industry_note": "A standard contract limits IP assignment to work done on company time/resources and includes a clear carve-out for personal projects."
        },
        {
            "clause_type": "NON_COMPETE",
            "standard_text": "The Employee agrees not to compete with the Employer for a period of up to 6 months post-employment, strictly limited to the direct competitors within the immediate local metropolitan area.",
            "classification": "STANDARD",
            "industry_note": "Non-competes extending beyond 6-12 months or spanning global geographies are aggressive and increasingly banned by state and federal regulators."
        },
        {
            "clause_type": "TERMINATION",
            "standard_text": "Either party may terminate this agreement with 2 to 4 weeks written notice. In the event of termination by the Employer without cause, the Employee shall receive severance based on length of service.",
            "classification": "STANDARD",
            "industry_note": "At-will clauses allowing immediate dismissal with zero severance represent high employer leverage; standard contracts usually offer transition periods."
        }
    ],
    "Software / SaaS Terms": [
        {
            "clause_type": "AUTO_RENEWAL",
            "standard_text": "Subscriptions automatically renew at the end of the term. Users must receive notice of renewal 30 days prior to charging, with an easy one-click cancellation path available online.",
            "classification": "STANDARD",
            "industry_note": "Sneaky auto-renewals with no pre-billing alerts or complex cancellation hurdles (e.g., calling customer service) are predatory."
        },
        {
            "clause_type": "ARBITRATION",
            "standard_text": "Any dispute arising from these terms will be settled in small claims court, or through standard arbitration in the user's local jurisdiction, with both parties covering their own basic costs.",
            "classification": "STANDARD",
            "industry_note": "Aggressive clauses lock users into high-cost arbitration in distant venues and strip class-action rights, which benefits the service provider."
        }
    ],
    "Rental / Lease Agreement": [
        {
            "clause_type": "AMENDMENT",
            "standard_text": "Any changes or modifications to the terms of this lease must be agreed upon in writing by both the Landlord and the Tenant, requiring 30 days written notice.",
            "classification": "STANDARD",
            "industry_note": "Unilateral amendment clauses allowing landlords or platform operators to rewrite terms without user approval are highly exploitative."
        },
        {
            "clause_type": "JURISDICTION",
            "standard_text": "This agreement shall be governed by and construed in accordance with the laws of the state and municipality in which the leased property is located.",
            "classification": "STANDARD",
            "industry_note": "Standard leases always resolve disputes locally. Forcing a tenant to sue in another state is extremely unusual."
        }
    ],
    "Freelance / NDA": [
        {
            "clause_type": "INDEMNIFICATION",
            "standard_text": "Each party agrees to indemnify and hold harmless the other party strictly to the extent of direct damages caused by their respective breach of warranty or negligence.",
            "classification": "STANDARD",
            "industry_note": "Unilateral indemnification where the signer shields the drafter from all liabilities without reciprocal protection is highly aggressive."
        }
    ]
}

# Lazy loading wrappers for PyTorch / SentenceTransformers and ChromaDB
_embedding_model = None
_chroma_client = None
_chroma_db_collection = None

def get_fallback_embeddings(text: str) -> List[float]:
    """Generates simple TF-IDF bag-of-words pseudo-embeddings for fast local fallback."""
    text = text.lower()
    words = re.findall(r'\w+', text)
    # Generate a simple 128-dimensional vector based on word hashes
    vector = [0.0] * 128
    if not words:
        return vector
    for word in words:
        # Simple hash trick to map word to index
        idx = hash(word) % 128
        vector[idx] += 1.0
    # Normalize vector
    magnitude = math.sqrt(sum(v * v for v in vector))
    if magnitude > 0:
        vector = [v / magnitude for v in vector]
    return vector

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculates cosine similarity between two numeric vectors."""
    if len(v1) != len(v2) or not v1:
        return 0.0
    dot_prod = sum(a * b for a, b in zip(v1, v2))
    mag1 = math.sqrt(sum(a * a for a in v1))
    mag2 = math.sqrt(sum(b * b for b in v2))
    if mag1 * mag2 == 0:
        return 0.0
    return dot_prod / (mag1 * mag2)

def init_resources():
    """Tries to initialize SentenceTransformers and ChromaDB, degrading gracefully if unavailable."""
    global _embedding_model, _chroma_client, _chroma_db_collection
    
    # Try importing sentence-transformers
    try:
        if _embedding_model is None:
            from sentence_transformers import SentenceTransformer
            logger.info("Initializing SentenceTransformer('all-MiniLM-L6-v2')...")
            _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("SentenceTransformer loaded successfully.")
    except Exception as e:
        logger.warning(f"Could not load SentenceTransformers. Falling back to bag-of-words embeddings: {e}")
        _embedding_model = "FALLBACK"
        
    # Try importing chromadb
    try:
        if _chroma_client is None:
            import chromadb
            logger.info("Initializing ChromaDB Embedded Client...")
            _chroma_client = chromadb.PersistentClient(path="A:/Antigravity_projects/ascent_promptwar/backend/chroma_data")
            _chroma_db_collection = _chroma_client.get_or_create_collection("benchmark_clauses")
            
            # Preseed ChromaDB if empty
            if _chroma_db_collection.count() == 0:
                logger.info("Pre-seeding ChromaDB with fair-market standard clauses...")
                ids = []
                documents = []
                metadatas = []
                embeddings = []
                idx = 0
                for doc_type, items in BENCHMARK_PRESETS.items():
                    for item in items:
                        c_id = f"preset_{idx}"
                        doc_text = item["standard_text"]
                        
                        # Generate embedding
                        if _embedding_model and _embedding_model != "FALLBACK":
                            embed = _embedding_model.encode(doc_text).tolist()
                        else:
                            embed = get_fallback_embeddings(doc_text)
                            
                        ids.append(c_id)
                        documents.append(doc_text)
                        embeddings.append(embed)
                        metadatas.append({
                            "doc_type": doc_type,
                            "clause_type": item["clause_type"],
                            "classification": item["classification"],
                            "industry_note": item["industry_note"]
                        })
                        idx += 1
                
                # Add to collection
                _chroma_db_collection.add(
                    ids=ids,
                    embeddings=embeddings,
                    documents=documents,
                    metadatas=metadatas
                )
                logger.info(f"Seeded {idx} clauses in ChromaDB collection.")
    except Exception as e:
        logger.warning(f"Could not load ChromaDB client. Running with local memory vector store: {e}")
        _chroma_client = "FALLBACK"

def get_clause_embedding(text: str) -> List[float]:
    """Retrieves standard or fallback embeddings for a clause."""
    init_resources()
    if _embedding_model and _embedding_model != "FALLBACK":
        try:
            return _embedding_model.encode(text).tolist()
        except Exception as e:
            logger.error(f"Encoding failed, falling back: {e}")
    return get_fallback_embeddings(text)

def query_benchmark_standards(clause_text: str, clause_type: str, doc_category: str) -> Dict[str, Any]:
    """
    Finds the closest fair-market standard clause matching the query.
    Uses ChromaDB if active, otherwise scans the embedded local memorypresets.
    """
    init_resources()
    
    # Try querying ChromaDB
    if _chroma_client and _chroma_client != "FALLBACK" and _chroma_db_collection:
        try:
            query_embed = get_clause_embedding(clause_text)
            results = _chroma_db_collection.query(
                query_embeddings=[query_embed],
                n_results=1,
                where={"clause_type": clause_type}
            )
            if results and results["documents"] and results["documents"][0]:
                meta = results["metadatas"][0][0]
                return {
                    "classification": meta.get("classification", "STANDARD"),
                    "industry_standard": results["documents"][0][0],
                    "industry_note": meta.get("industry_note", "No additional guidelines.")
                }
        except Exception as e:
            logger.error(f"ChromaDB query failed: {e}. Falling back to memory search.")

    # In-memory scan fallback
    doc_presets = BENCHMARK_PRESETS.get(doc_category, [])
    if not doc_presets:
        # Fall back to any available category for this clause type
        doc_presets = []
        for cat_presets in BENCHMARK_PRESETS.values():
            doc_presets.extend(cat_presets)
            
    best_match = None
    best_similarity = -1.0
    query_embed = get_clause_embedding(clause_text)
    
    for item in doc_presets:
        if item["clause_type"] == clause_type:
            preset_embed = get_clause_embedding(item["standard_text"])
            sim = cosine_similarity(query_embed, preset_embed)
            if sim > best_similarity:
                best_similarity = sim
                best_match = item
                
    if best_match:
        return {
            "classification": best_match["classification"] if best_similarity > 0.6 else "UNUSUAL",
            "industry_standard": best_match["standard_text"],
            "industry_note": best_match["industry_note"]
        }
        
    # Default fallback if nothing found
    return {
        "classification": "STANDARD",
        "industry_standard": "Standard clauses of this type generally maintain equal liabilities and explicit exclusions.",
        "industry_note": "A reasonable industry standard clause balance has been assumed."
    }
