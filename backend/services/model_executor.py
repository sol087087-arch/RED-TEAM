import asyncio
import aiohttp
import time
from typing import List, Dict, Any, Optional
from datetime import datetime

from services.openrouter_parse import extract_openrouter_choice


class ModelExecutor:
    """Handles isolated, parallel execution of prompts across multiple models."""

    def __init__(self):
        self.timeout = aiohttp.ClientTimeout(total=120)

    async def execute_prompt(
        self,
        system_context: str,
        user_prompt: str,
        model_configs: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Execute prompt against multiple models in parallel.
        Each model gets an isolated request with no knowledge of others.
        """
        tasks = [
            self._call_model(system_context, user_prompt, config)
            for config in model_configs
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        formatted_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                formatted_results.append({
                    "model_name": model_configs[i]["model_name"],
                    "response_text": "",
                    "error_message": str(result),
                    "latency_ms": None,
                    "tokens_used": None,
                })
            else:
                formatted_results.append(result)

        return formatted_results

    async def _call_model(
        self, system_context: str, user_prompt: str, config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Make isolated call to a single model."""
        start_time = time.time()

        try:
            if config["endpoint_type"] == "openrouter":
                return await self._call_openrouter(
                    system_context, user_prompt, config, start_time
                )
            elif config["endpoint_type"] == "together_ai":
                return await self._call_together_ai(
                    system_context, user_prompt, config, start_time
                )
            elif config["endpoint_type"] == "ollama":
                return await self._call_ollama(
                    system_context, user_prompt, config, start_time
                )
            elif config["endpoint_type"] == "hugging_face":
                return await self._call_hugging_face(
                    system_context, user_prompt, config, start_time
                )
            else:
                raise ValueError(f"Unknown endpoint type: {config['endpoint_type']}")
        except Exception as e:
            return {
                "model_name": config["model_name"],
                "response_text": "",
                "error_message": str(e),
                "latency_ms": None,
                "tokens_used": None,
            }

    async def _call_openrouter(
        self, system_context: str, user_prompt: str, config: Dict[str, Any], start_time: float
    ) -> Dict[str, Any]:
        """Call OpenRouter API with isolated context."""
        messages = [
            {"role": "system", "content": system_context},
            {"role": "user", "content": user_prompt},
        ]

        payload = {
            "model": config["endpoint_url"],
            "messages": messages,
            "max_tokens": config.get("max_tokens", 2000),
            "temperature": config.get("temperature", 0.7),
        }

        headers = {
            "Authorization": f"Bearer {config['api_key']}",
            "HTTP-Referer": "https://teamtesthub.us",
            "X-Title": "Red Team Test Hub",
            "Content-Type": "application/json",
        }

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.post(
                "https://openrouter.ai/api/v1/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    latency_ms = (time.time() - start_time) * 1000
                    choices = data.get("choices") or []
                    choice0 = choices[0] if choices else None
                    text, finish_reason, explicit_refusal = extract_openrouter_choice(
                        choice0
                    )
                    return {
                        "model_name": config["model_name"],
                        "response_text": text,
                        "latency_ms": latency_ms,
                        "tokens_used": data.get("usage", {}).get("total_tokens"),
                        "error_message": None,
                        "finish_reason": finish_reason,
                        "explicit_refusal": explicit_refusal,
                    }
                else:
                    error_text = await response.text()
                    raise Exception(f"OpenRouter API error: {error_text}")

    async def _call_together_ai(
        self, system_context: str, user_prompt: str, config: Dict[str, Any], start_time: float
    ) -> Dict[str, Any]:
        """Call Together.ai API with isolated context."""
        messages = [
            {"role": "system", "content": system_context},
            {"role": "user", "content": user_prompt},
        ]

        payload = {
            "model": config["endpoint_url"],
            "messages": messages,
            "max_tokens": config.get("max_tokens", 2000),
            "temperature": config.get("temperature", 0.7),
        }

        headers = {
            "Authorization": f"Bearer {config['api_key']}",
            "Content-Type": "application/json",
        }

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.post(
                "https://api.together.xyz/v1/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    latency_ms = (time.time() - start_time) * 1000
                    return {
                        "model_name": config["model_name"],
                        "response_text": data["choices"][0]["message"]["content"],
                        "latency_ms": latency_ms,
                        "tokens_used": data.get("usage", {}).get("total_tokens"),
                        "error_message": None,
                    }
                else:
                    error_text = await response.text()
                    raise Exception(f"Together.ai API error: {error_text}")

    async def _call_ollama(
        self, system_context: str, user_prompt: str, config: Dict[str, Any], start_time: float
    ) -> Dict[str, Any]:
        """Call local Ollama instance."""
        prompt_text = f"{system_context}\n\n{user_prompt}"

        payload = {
            "model": config["endpoint_url"],
            "prompt": prompt_text,
            "stream": False,
        }

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.post(
                "http://localhost:11434/api/generate",
                json=payload,
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    latency_ms = (time.time() - start_time) * 1000
                    return {
                        "model_name": config["model_name"],
                        "response_text": data.get("response", ""),
                        "latency_ms": latency_ms,
                        "tokens_used": None,
                        "error_message": None,
                    }
                else:
                    raise Exception("Ollama connection failed")

    async def _call_hugging_face(
        self, system_context: str, user_prompt: str, config: Dict[str, Any], start_time: float
    ) -> Dict[str, Any]:
        """Call Hugging Face Inference API."""
        messages = [
            {"role": "system", "content": system_context},
            {"role": "user", "content": user_prompt},
        ]

        payload = {
            "inputs": messages,
            "parameters": {
                "max_new_tokens": config.get("max_tokens", 2000),
                "temperature": config.get("temperature", 0.7),
            },
        }

        headers = {
            "Authorization": f"Bearer {config['api_key']}",
            "Content-Type": "application/json",
        }

        async with aiohttp.ClientSession(timeout=self.timeout) as session:
            async with session.post(
                f"https://api-inference.huggingface.co/models/{config['endpoint_url']}",
                json=payload,
                headers=headers,
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    latency_ms = (time.time() - start_time) * 1000
                    return {
                        "model_name": config["model_name"],
                        "response_text": data[0].get("generated_text", ""),
                        "latency_ms": latency_ms,
                        "tokens_used": None,
                        "error_message": None,
                    }
                else:
                    error_text = await response.text()
                    raise Exception(f"HF API error: {error_text}")
