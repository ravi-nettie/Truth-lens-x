"""backend/app/analyzers/text/entities.py

Named Entity Recognition (NER) for TruthLens X.
Extracts: PERSON, ORG, GPE, LOC, EVENT
Adheres strictly to Rule 2:
- Tries offline spaCy en_core_web_sm first
- Gracefully falls back to capitalized-phrase regex & gazetteer heuristics when spaCy model is unavailable
- Pure functional design, no DB access, no unhandled exceptions
"""

import re
from typing import Any, Dict, List, Optional, Set, Tuple


KNOWN_ORGS = {
    "un", "united nations", "nato", "fbi", "cia", "eu", "european union", "who", "imf",
    "bbc", "cnn", "reuters", "ap", "associated press", "al jazeera", "fox news", "msnbc",
    "google", "apple", "microsoft", "meta", "facebook", "twitter", "x", "amazon", "openai",
    "white house", "kremlin", "pentagon", "congress", "senate", "parliament", "supreme court",
    "red cross", "hamas", "idf", "hezbollah", "taliban"
}

KNOWN_GPES = {
    "united states", "usa", "us", "uk", "united kingdom", "russia", "ukraine", "china",
    "india", "france", "germany", "israel", "palestine", "gaza", "iran", "iraq", "syria",
    "japan", "canada", "mexico", "brazil", "turkey", "egypt", "taiwan", "korea",
    "washington", "london", "paris", "berlin", "kyiv", "kiev", "moscow", "beijing", "tokyo",
    "new york", "los angeles", "chicago", "san francisco", "texas", "california", "florida"
}

KNOWN_EVENTS = {
    "olympics", "world cup", "super bowl", "election", "presidential election",
    "summit", "g7", "g20", "climate summit", "cop28", "protest", "rally", "inauguration"
}

STOPWORDS = {
    "the", "a", "an", "this", "that", "these", "those", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "up", "about", "into", "over", "after", "beneath",
    "under", "above", "he", "she", "they", "we", "i", "it", "his", "her", "their",
    "my", "our", "its", "and", "but", "or", "so", "then", "there", "when", "where",
    "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some",
    "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "yesterday", "today", "tomorrow", "monday", "tuesday", "wednesday", "thursday",
    "friday", "saturday", "sunday", "january", "february", "march", "april", "may",
    "june", "july", "august", "september", "october", "november", "december"
}

_SPACY_NLP = None
_SPACY_TRIED = False


def get_spacy_nlp():
    global _SPACY_NLP, _SPACY_TRIED
    if not _SPACY_TRIED:
        _SPACY_TRIED = True
        try:
            import spacy
            _SPACY_NLP = spacy.load("en_core_web_sm")
        except Exception:
            _SPACY_NLP = None
    return _SPACY_NLP


def extract_entities_regex(text: str) -> List[Dict[str, Any]]:
    """
    Fallback deterministic regex NER extractor for PERSON, ORG, GPE, LOC, EVENT.
    """
    entities: List[Dict[str, Any]] = []
    if not text:
        return entities

    # Match consecutive title-cased words (ignoring sentence-initial single words)
    pattern = re.compile(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b")

    for m in pattern.finditer(text):
        raw_phrase = m.group(0).strip()
        lower_phrase = raw_phrase.lower()

        # Filter out standalone common words, months, weekdays
        if lower_phrase in STOPWORDS:
            continue

        # Don't tag single words at start of sentence unless recognized
        is_sentence_start = (m.start() == 0 or text[max(0, m.start() - 2)] in ".?!")
        words = raw_phrase.split()
        if len(words) == 1 and is_sentence_start and lower_phrase not in KNOWN_ORGS and lower_phrase not in KNOWN_GPES:
            continue

        label = "PERSON"
        if lower_phrase in KNOWN_ORGS or any(org in lower_phrase for org in ["inc", "corp", "party", "ministry", "agency", "department", "bank"]):
            label = "ORG"
        elif lower_phrase in KNOWN_GPES or any(term in lower_phrase for term in ["republic", "kingdom", "city", "county", "state", "province"]):
            label = "GPE"
        elif lower_phrase in KNOWN_EVENTS or any(term in lower_phrase for term in ["summit", "cup", "games", "treaty"]):
            label = "EVENT"
        elif len(words) >= 2:
            label = "PERSON"
        else:
            # Single capitalized word
            if is_sentence_start:
                continue
            label = "PERSON"

        entities.append({
            "text": raw_phrase,
            "label": label,
            "span": (m.start(), m.end()),
            "method": "regex_gazetteer_fallback"
        })

    return entities


def extract_entities(text: str) -> Tuple[List[Dict[str, Any]], str]:
    """
    Extracts named entities from text.
    Returns:
    - List of entities with text, label, span, method
    - Method used ("spacy_en_core_web_sm" or "regex_gazetteer_fallback")
    """
    nlp = get_spacy_nlp()
    if nlp is not None:
        try:
            doc = nlp(text)
            entities = []
            target_labels = {"PERSON", "ORG", "GPE", "LOC", "EVENT"}
            for ent in doc.ents:
                if ent.label_ in target_labels:
                    entities.append({
                        "text": ent.text.strip(),
                        "label": ent.label_,
                        "span": (ent.start_char, ent.end_char),
                        "method": "spacy_en_core_web_sm"
                    })
            return entities, "spacy_en_core_web_sm"
        except Exception:
            pass

    return extract_entities_regex(text), "regex_gazetteer_fallback"

