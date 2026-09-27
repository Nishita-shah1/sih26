"""Explainable stylometry for short writing samples.

Compares sentence length, punctuation, pronouns, formal connectors,
lexical variety, digits, and capitals. Scores are similarity assists
for an analyst. They are not an identity determination.
"""

from __future__ import annotations

import math
import re

FEATURE_LABELS = {
    "avg_word_len": "word length",
    "avg_sent_len": "sentence length",
    "ttr": "vocabulary variety",
    "comma": "comma rate",
    "period": "period rate",
    "apostrophe": "contractions",
    "digit": "digit rate",
    "upper": "capitals",
    "i_rate": "first-person I",
    "we_rate": "first-person we",
    "formal": "formal connectors",
}

SCALE = {
    "avg_word_len": 6.0,
    "avg_sent_len": 25.0,
    "ttr": 1.0,
    "comma": 1 / 20,
    "period": 1 / 15,
    "apostrophe": 1 / 30,
    "digit": 1 / 15,
    "upper": 1 / 10,
    "i_rate": 1 / 8,
    "we_rate": 1 / 10,
    "formal": 1 / 15,
}

FORMAL_MARKERS = ("therefore", "regarding", "however", "please", "thus", "shall")


def _words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z']+", text.lower())


def features(text: str) -> dict[str, float]:
    raw = text or ""
    words = _words(raw)
    sentences = [part for part in re.split(r"[.!?]+", raw) if part.strip()]
    count = len(words) or 1
    unique = len(set(words))
    lowered = [w.strip("'") for w in words]
    length = max(len(raw), 1)
    return {
        "avg_word_len": sum(len(word) for word in words) / count,
        "avg_sent_len": count / max(len(sentences), 1),
        "ttr": unique / count,
        "comma": raw.count(",") / length,
        "period": raw.count(".") / length,
        "apostrophe": raw.count("'") / length,
        "digit": sum(ch.isdigit() for ch in raw) / length,
        "upper": sum(ch.isupper() for ch in raw) / length,
        "i_rate": lowered.count("i") / count,
        "we_rate": lowered.count("we") / count,
        "formal": sum(lowered.count(marker) for marker in FORMAL_MARKERS) / count,
    }


def word_count(text: str) -> int:
    return len(_words(text))


def _scaled(feats: dict[str, float]) -> dict[str, float]:
    return {key: feats.get(key, 0.0) / SCALE[key] for key in SCALE}


def _cosine(left: dict[str, float], right: dict[str, float]) -> float:
    keys = set(left) | set(right)
    dot = sum(left.get(key, 0.0) * right.get(key, 0.0) for key in keys)
    left_norm = math.sqrt(sum(value * value for value in left.values()))
    right_norm = math.sqrt(sum(value * value for value in right.values()))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def similarity(left_text: str, right_text: str) -> float:
    score = _cosine(_scaled(features(left_text)), _scaled(features(right_text)))
    return round(max(0.0, min(1.0, score)) * 100, 1)


def explain(left_text: str, right_text: str) -> dict[str, list[str]]:
    left = _scaled(features(left_text))
    right = _scaled(features(right_text))
    ranked = sorted(
        ((abs(left[key] - right[key]), key) for key in left),
        key=lambda item: item[0],
    )
    aligned = [FEATURE_LABELS[key] for _, key in ranked[:3]]
    divergent = [FEATURE_LABELS[key] for _, key in reversed(ranked[-3:])]
    return {"aligned": aligned, "divergent": divergent}


def rank_samples(text: str, samples: list[dict]) -> list[dict]:
    """Pick the best stored sample per actor."""
    best: dict[int, dict] = {}
    for sample in samples:
        score = similarity(text, sample["body"])
        actor_id = int(sample["actor_id"])
        current = best.get(actor_id)
        if current is None or score > current["score"]:
            detail = explain(text, sample["body"])
            best[actor_id] = {
                "actor_id": actor_id,
                "score": score,
                "sample_label": sample.get("label") or "",
                "aligned": detail["aligned"],
                "divergent": detail["divergent"],
            }
    return sorted(best.values(), key=lambda item: item["score"], reverse=True)
