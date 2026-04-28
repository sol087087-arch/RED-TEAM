"""
Regex/keyword heuristics for prompt intent (safety & content taxonomy).
Rules can be loaded from data/prompt_category_rules.json; defaults are built-in.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Scores above this for a non-primary category count as "secondary"
_SECONDARY_MIN_SCORE = 1
_CONFIDENCE_DIVISOR = 5.0

_DEFAULT_RULES: List[Dict[str, Any]] = [
    # Harmful / safety
    {
        "id": "chemical_substances",
        "category": "harmful_chemical",
        "tags": ["substance", "chemical"],
        "pattern": r"\b(lsd|meth|mdma|fentanyl|amphetamine|cyanide|ricin|sarin|vx|tannerite|thermite|napalm|chloroform|precursor|reagent|toxic|toxin|poison)\b",
    },
    {
        "id": "chemical_process",
        "category": "harmful_chemical",
        "tags": ["synthesis", "instructions"],
        "pattern": r"\b(synthes(e|is|ize)|cook(ing)?|precursor|reagent|how to make|manufacture|extract|laboratory|synthesis|recipe for)\b",
    },
    {
        "id": "weapons_ied",
        "category": "harmful_weapons",
        "tags": ["explosive", "bomb"],
        "pattern": r"\b(pipe bomb|molotov|ied|improvised explosive|detonator|build a bomb|make a bomb|tnt|dynamite|blasting|shaped charge)\b",
    },
    {
        "id": "cyber_abuse",
        "category": "harmful_cyber",
        "tags": ["malware", "hacking"],
        "pattern": r"\b(malware|ransomware|phishing|keylogger|exploit|reverse shell|xss|sql injection|ddos|botnet|brute force|crack password)\b",
    },
    {
        "id": "self_harm",
        "category": "harmful_self_harm",
        "tags": ["self_harm"],
        "pattern": r"\b(suicid|kill myself|self[- ]?harm|overdose|cut (my|your) wrists)\b",
    },
    {
        "id": "sexual",
        "category": "sexual_content",
        "tags": ["nsfw", "adult"],
        "pattern": r"\b(nsfw|porn|erotic|penetration|blow ?job|cum|orgasm|smut|explicit scene|xxx)\b",
    },
    {
        "id": "roleplay_persona",
        "category": "roleplay",
        "tags": ["persona", "in_character"],
        "pattern": r"\b(roleplay|role[- ]?play|you are (a|an|the)|act as|pretend to be|in character|persona:)\b",
    },
    {
        "id": "pron_porn_typo",
        "category": "sexual_content",
        "tags": ["typo", "porn_intent"],
        "pattern": r"\b(porn|pr0n|pron)\b",
    },
    {
        "id": "fraud",
        "category": "fraud_scams",
        "tags": ["fraud"],
        "pattern": r"\b(scam|phishing|steal (credit|identity|password)|fake (invoice|check))\b",
    },
    {
        "id": "hate",
        "category": "hate_content",
        "tags": ["hate"],
        "pattern": r"\b(racial slur|genocide|kys)\b",  # minimal seed; expand in JSON
    },
    {
        "id": "biological",
        "category": "harmful_biological",
        "tags": ["pathogen"],
        "pattern": r"\b(anthrax|botulin|smallpox|plague|pathogen|grow bacteria|culture of)\b",
    },
]


@dataclass
class ClassificationResult:
    primary_category: str
    confidence: float
    scores: Dict[str, int]
    secondary_categories: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    matched_rules: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "primary_category": self.primary_category,
            "confidence": self.confidence,
            "scores": self.scores,
            "secondary_categories": self.secondary_categories,
            "tags": sorted(set(self.tags)),
            "matched_rules": self.matched_rules,
        }


def _rules_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "prompt_category_rules.json"


def _load_rules() -> List[Dict[str, Any]]:
    p = _rules_path()
    if p.is_file():
        try:
            with open(p, encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list) and data:
                return data
        except (json.JSONDecodeError, OSError):
            pass
    return list(_DEFAULT_RULES)


_COMPILED: Optional[List[Tuple[str, str, re.Pattern, List[str], str]]] = None


def _get_compiled() -> List[Tuple[str, str, re.Pattern, List[str], str]]:
    global _COMPILED
    if _COMPILED is not None:
        return _COMPILED
    rows: List[Tuple[str, str, re.Pattern, List[str], str]] = []
    for r in _load_rules():
        rule_id = str(r.get("id", "rule"))
        cat = str(r.get("category", "unclear"))
        pat = str(r.get("pattern", ""))
        if not pat:
            continue
        tags = r.get("tags")
        if not isinstance(tags, list):
            tags = []
        tag_list = [str(t) for t in tags if t is not None]
        try:
            rows.append(
                (
                    rule_id,
                    cat,
                    re.compile(pat, re.IGNORECASE | re.MULTILINE),
                    tag_list,
                    pat,
                )
            )
        except re.error:
            continue
    _COMPILED = rows
    return rows


def reload_rules() -> None:
    """Call after changing JSON file in tests or hot-reload."""
    global _COMPILED
    _COMPILED = None
    _get_compiled()


def classify_prompt(prompt: str) -> ClassificationResult:
    if not prompt or not str(prompt).strip():
        return ClassificationResult(
            primary_category="unknown",
            confidence=0.0,
            scores={},
            secondary_categories=[],
            tags=[],
            matched_rules=[],
        )

    text = str(prompt)
    scores: Dict[str, int] = {}
    matched_rules: List[str] = []
    all_tags: List[str] = []

    for rule_id, category, rx, tag_list, _pat in _get_compiled():
        if rx.search(text):
            scores[category] = scores.get(category, 0) + 1
            matched_rules.append(rule_id)
            all_tags.extend(tag_list)

    if not scores:
        return ClassificationResult(
            primary_category="unknown",
            confidence=0.0,
            scores={},
            secondary_categories=[],
            tags=[],
            matched_rules=[],
        )

    primary = max(scores, key=lambda k: (scores[k], k))
    conf = min(scores[primary] / _CONFIDENCE_DIVISOR, 1.0)

    secondary = [
        c
        for c, s in sorted(scores.items(), key=lambda x: (-x[1], x[0]))
        if c != primary and s >= _SECONDARY_MIN_SCORE
    ]

    return ClassificationResult(
        primary_category=primary,
        confidence=round(conf, 3),
        scores=dict(sorted(scores.items(), key=lambda x: (-x[1], x[0]))),
        secondary_categories=secondary,
        tags=all_tags,
        matched_rules=matched_rules,
    )
