import os
import json
import httpx
import asyncio
import logging
import re
from typing import Dict, Any, Optional

logger = logging.getLogger("lexguard.llm")
logging.basicConfig(level=logging.INFO)

# Unified LLM models mapping
GROQ_MODELS = {
    "reasoning": "llama-3.3-70b-versatile",
    "extraction": "llama-3.1-8b-instant",
    "structured": "mixtral-8x7b-32768",
    "fallback": "gemma2-9b-it"
}

OPENROUTER_MODELS = {
    "reasoning": "meta-llama/llama-3.1-8b-instruct:free",
    "extraction": "mistralai/mistral-7b-instruct:free",
    "structured": "google/gemma-2-9b-it:free",
    "fallback": "google/gemma-2-9b-it:free"
}

def clean_json_string(text: str) -> str:
    """Sanitizes LLM outputs by removing markdown code fences and whitespace."""
    text = text.strip()
    # Remove markdown code block fences if present
    match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text

async def _call_groq_api(system_prompt: str, user_content: str, model: str, temperature: float, api_key: str) -> str:
    """Invokes the Groq API via HTTP POST."""
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    # Check if we should enforce JSON format (Mixtral/Llama support json_object)
    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
    }
    
    # Groq supports native json response format for major models
    if "mixtral" in model.lower() or "llama-3" in model.lower():
        payload["response_format"] = {"type": "json_object"}
        
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

async def _call_openrouter_api(system_prompt: str, user_content: str, model: str, temperature: float, api_key: str) -> str:
    """Invokes OpenRouter API as a fallback."""
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://lexguard.ai",
        "X-Title": "LexGuard Contract Intelligence"
    }
    
    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
    }
    
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

async def call_llm(
    system_prompt: str,
    user_content: str,
    task_type: str = "reasoning",
    temperature: float = 0.2,
    max_retries: int = 2
) -> Dict[str, Any]:
    """
    Routes LLM requests to Groq with OpenRouter fallback.
    If no keys are configured, fails over to Simulation Mode values or logs.
    """
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    
    # Force simulation mode if no keys present
    if not groq_key and not openrouter_key:
        logger.warning("No API keys found for Groq or OpenRouter. Running in simulated pass-through mode.")
        raise ValueError("API_KEYS_MISSING")

    # Try Groq first
    if groq_key:
        model = GROQ_MODELS.get(task_type, GROQ_MODELS["reasoning"])
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"Attempting Groq call using model: {model} (Attempt {attempt+1}/{max_retries+1})")
                raw_response = await _call_groq_api(system_prompt, user_content, model, temperature, groq_key)
                cleaned = clean_json_string(raw_response)
                return json.loads(cleaned)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429: # Rate Limit
                    logger.warning(f"Groq Rate Limit (429) hit on attempt {attempt+1}. Retrying with fallback model or waiting...")
                    if attempt < max_retries:
                        # Try a smaller model on subsequent attempt
                        model = GROQ_MODELS["fallback"]
                        await asyncio.sleep(2.0 * (attempt + 1))
                        continue
                logger.error(f"Groq API error: {e}")
                break # Jump to OpenRouter fallback
            except Exception as e:
                logger.error(f"Error calling Groq on attempt {attempt+1}: {e}")
                if attempt < max_retries:
                    await asyncio.sleep(1.0)
                    continue
                break

    # Fallback to OpenRouter
    if openrouter_key:
        model = OPENROUTER_MODELS.get(task_type, OPENROUTER_MODELS["reasoning"])
        for attempt in range(max_retries + 1):
            try:
                logger.info(f"Attempting OpenRouter fallback using model: {model} (Attempt {attempt+1})")
                raw_response = await _call_openrouter_api(system_prompt, user_content, model, temperature, openrouter_key)
                cleaned = clean_json_string(raw_response)
                return json.loads(cleaned)
            except Exception as e:
                logger.error(f"OpenRouter call failed: {e}")
                if attempt < max_retries:
                    await asyncio.sleep(2.0)
                    continue
                
    raise RuntimeError("All LLM providers (Groq & OpenRouter) failed or are unconfigured.")
