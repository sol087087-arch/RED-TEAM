from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.prompt_classifier import classify_prompt

router = APIRouter(prefix="/api/prompt", tags=["prompt"])


class ClassifyBody(BaseModel):
    prompt: str = Field(..., min_length=0, max_length=1_000_000)


@router.post("/classify")
async def classify(body: ClassifyBody):
    """Heuristic (regex) classification of a user prompt for dashboards and pre-filters."""
    return classify_prompt(body.prompt).to_dict()
