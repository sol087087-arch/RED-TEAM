"""Normalize OpenRouter / OpenAI-style chat completion choices (content, refusal, finish_reason)."""

from typing import Any, Dict, List, Optional, Tuple


def extract_openrouter_choice(
    choice: Optional[Dict[str, Any]],
) -> Tuple[str, Optional[str], bool]:
    """
    Returns (assistant_text, finish_reason, explicit_refusal).
    explicit_refusal is True when the API put text in message.refusal or a refusal part.
    """
    if not choice:
        return "", None, False

    fr = choice.get("finish_reason") or choice.get("native_finish_reason")
    fr_s = str(fr) if fr is not None else None

    msg = choice.get("message") or {}
    refusal = msg.get("refusal")
    if isinstance(refusal, str) and refusal.strip():
        return refusal.strip(), fr_s, True

    content = msg.get("content")
    if isinstance(content, str):
        return content or "", fr_s, False

    if isinstance(content, list):
        parts: List[str] = []
        explicit = False
        for p in content:
            if not isinstance(p, dict):
                continue
            if p.get("type") == "refusal" and isinstance(p.get("refusal"), str):
                parts.append(p["refusal"])
                explicit = True
            elif p.get("type") == "text" and isinstance(p.get("text"), str):
                parts.append(p["text"])
        return "".join(parts), fr_s, explicit

    return "", fr_s, False
