from fastapi import APIRouter
from pydantic import BaseModel
from services.openrouter_client import OpenRouterClient
from services.evaluation import ResponseEvaluator
import time

router = APIRouter(prefix="/api/openrouter", tags=["openrouter"])
evaluator = ResponseEvaluator()


class TestRequest(BaseModel):
    model_id: str
    prompt: str
    api_key: str


@router.get("/models")
async def get_available_models(api_key: str = None):
    """Get list of available models from OpenRouter."""
    client = OpenRouterClient(api_key)
    models = await client.get_available_models()
    return {"models": models}


@router.post("/validate-key")
async def validate_api_key(api_key: str):
    """Validate OpenRouter API key by attempting to fetch models."""
    client = OpenRouterClient(api_key)
    models = await client.get_available_models()
    return {"valid": len(models) > 0, "model_count": len(models)}


@router.post("/test")
async def test_model(request: TestRequest):
    """Test a single model with a prompt and return evaluation."""
    start_time = time.time()
    client = OpenRouterClient(request.api_key)

    messages = [
        {"role": "user", "content": request.prompt}
    ]

    result = await client.call_model(
        model_id=request.model_id,
        messages=messages,
        max_tokens=2000,
        temperature=0.7
    )

    latency_ms = (time.time() - start_time) * 1000

    eval_status, eval_reason = evaluator.evaluate(
        result["response_text"],
        finish_reason=result.get("finish_reason"),
        explicit_refusal=result.get("explicit_refusal", False),
    )

    return {
        "model_id": request.model_id,
        "response_text": result["response_text"],
        "latency_ms": latency_ms,
        "tokens_used": result["tokens_used"],
        "error_message": result["error"],
        "evaluation_status": eval_status,
        "evaluation_reason": eval_reason
    }
