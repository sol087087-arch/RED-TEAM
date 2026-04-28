import asyncio
import aiohttp
import json
from typing import List, Dict, Any
import os

from services.openrouter_parse import extract_openrouter_choice


class OpenRouterClient:
    """Client for OpenRouter API integration."""

    BASE_URL = "https://openrouter.ai/api/v1"
    MODELS_URL = f"{BASE_URL}/models"

    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")

    async def get_available_models(self) -> List[Dict[str, Any]]:
        """Fetch list of available models from OpenRouter."""
        if not self.api_key:
            return []

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://teamtesthub.us",
            "X-Title": "Red Team Test Hub",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.MODELS_URL,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        models = data.get("data", [])
                        return [
                            {
                                "id": model.get("id"),
                                "name": model.get("name", model.get("id")),
                                "pricing": model.get("pricing", {}),
                                "context_length": model.get("context_length", 4096),
                            }
                            for model in models
                        ]
        except Exception as e:
            print(f"Failed to fetch OpenRouter models: {e}")

        return []

    async def call_model(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        max_tokens: int = 2000,
        temperature: float = 0.7,
    ) -> Dict[str, Any]:
        """Call a model via OpenRouter API."""
        if not self.api_key:
            raise ValueError("OpenRouter API key not configured")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://teamtesthub.us",
            "X-Title": "Red Team Test Hub",
            "Content-Type": "application/json",
        }

        payload = {
            "model": model_id,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        choices = data.get("choices") or []
                        choice0 = choices[0] if choices else None
                        text, finish_reason, explicit_refusal = extract_openrouter_choice(
                            choice0
                        )
                        return {
                            "response_text": text,
                            "tokens_used": data.get("usage", {}).get("total_tokens"),
                            "error": None,
                            "finish_reason": finish_reason,
                            "explicit_refusal": explicit_refusal,
                        }
                    else:
                        error_text = await response.text()
                        return {
                            "response_text": "",
                            "tokens_used": None,
                            "error": f"OpenRouter error: {error_text}",
                        }
        except asyncio.TimeoutError:
            return {
                "response_text": "",
                "tokens_used": None,
                "error": "Request timeout",
            }
        except Exception as e:
            return {
                "response_text": "",
                "tokens_used": None,
                "error": str(e),
            }
