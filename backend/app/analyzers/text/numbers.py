"""backend/app/analyzers/text/numbers.py

Forensic numerical entity extraction and normalization for TruthLens X.
Normalizes:
- Spelled-out numbers ("three hundred" -> 300) via word2number
- Comma-separated integers ("3,000" -> 3000)
- Metric / financial shorthand ("3k" -> 3000, "2.5m" -> 2500000, "1b" -> 1000000000)
- Percentages ("25%" -> 25.0)
- Contextual unit extraction (e.g. "people", "protesters", "attendees", "dollars")
"""

import re
from typing import Any, Dict, List, Optional
from word2number import w2n


NUMBER_WORDS = {
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
    "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
    "hundred", "thousand", "million", "billion", "trillion", "a", "half"
}

KNOWN_UNITS = {
    "percent": ["%", "percent", "percentage", "pct"],
    "currency": ["$", "€", "£", "usd", "dollars", "euro", "euros", "cents"],
    "people": ["people", "protesters", "protestors", "attendees", "demonstrators", "supporters", "citizens", "crowd", "civilians", "victims", "refugees", "voters", "police", "officers", "troops", "soldiers", "persons"],
    "time": ["seconds", "sec", "minutes", "min", "hours", "hrs", "days", "weeks", "months", "years"],
    "distance": ["meters", "metres", "km", "kilometers", "miles", "feet", "yards"],
}


def extract_unit_context(text: str, end_idx: int) -> Optional[str]:
    """Finds unit following the numeric token."""
    sub = text[end_idx:].strip()
    match = re.match(r"^([a-zA-Z%]+)", sub)
    if not match:
        return None
    token = match.group(1).lower()
    for category, aliases in KNOWN_UNITS.items():
        if token in aliases:
            return category
    return token


def parse_shorthand_multiplier(val_str: str, suffix: str) -> float:
    base = float(val_str)
    s = suffix.lower()
    if s == "k":
        return base * 1_000
    elif s == "m":
        return base * 1_000_000
    elif s == "b":
        return base * 1_000_000_000
    return base


def extract_numbers(text: str) -> List[Dict[str, Any]]:
    """
    Extracts all numerical occurrences from text with normalized numeric values,
    associated units, and exact substring spans.
    """
    results: List[Dict[str, Any]] = []
    if not text:
        return results

    seen_spans = set()

    # 1. Shorthand notation: "3k", "2.5m", "10b"
    shorthand_pattern = re.compile(r"\b(\d+(?:\.\d+)?)\s*([kmbKMB])\b")
    for m in shorthand_pattern.finditer(text):
        val = parse_shorthand_multiplier(m.group(1), m.group(2))
        span = (m.start(), m.end())
        seen_spans.add(span)
        unit = extract_unit_context(text, m.end())
        results.append({
            "raw": m.group(0),
            "value": val,
            "unit": unit or "count",
            "span": span
        })

    # 2. Percentages: "25%", "12.5 %"
    pct_pattern = re.compile(r"\b(\d+(?:\.\d+)?)\s*%")
    for m in pct_pattern.finditer(text):
        val = float(m.group(1))
        span = (m.start(), m.end())
        seen_spans.add(span)
        results.append({
            "raw": m.group(0),
            "value": val,
            "unit": "percent",
            "span": span
        })

    # 3. Currency notation: "$500", "€1,200", "£3.5m"
    curr_pattern = re.compile(r"([\$€£])\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*([kmbKMB])?\b")
    for m in curr_pattern.finditer(text):
        num_part = m.group(2).replace(",", "")
        base_val = float(num_part)
        if m.group(3):
            val = parse_shorthand_multiplier(str(base_val), m.group(3))
        else:
            val = base_val
        span = (m.start(), m.end())
        seen_spans.add(span)
        results.append({
            "raw": m.group(0),
            "value": val,
            "unit": "currency",
            "span": span
        })

    # 4. Comma-separated or regular integers/floats: "3,000", "15000", "42.5"
    num_pattern = re.compile(r"\b\d{1,3}(?:,\d{3})+(?:\.\d+)?|\b\d+(?:\.\d+)?\b")
    for m in num_pattern.finditer(text):
        # Skip if part of already matched span
        if any(s[0] <= m.start() and m.end() <= s[1] for s in seen_spans):
            continue
        num_str = m.group(0).replace(",", "")
        try:
            val = float(num_str)
        except ValueError:
            continue
        span = (m.start(), m.end())
        seen_spans.add(span)
        unit = extract_unit_context(text, m.end())
        results.append({
            "raw": m.group(0),
            "value": val,
            "unit": unit or "count",
            "span": span
        })

    # 5. Spelled-out numbers via word2number: "three hundred", "twenty five"
    words = re.findall(r"\b[a-zA-Z\-]+\b", text)
    i = 0
    while i < len(words):
        w_lower = words[i].lower().replace("-", " ")
        parts = w_lower.split()
        if all(p in NUMBER_WORDS for p in parts):
            seq = [words[i]]
            j = i + 1
            while j < len(words):
                next_w = words[j].lower().replace("-", " ")
                next_parts = next_w.split()
                if all(p in NUMBER_WORDS for p in next_parts):
                    seq.append(words[j])
                    j += 1
                else:
                    break
            
            phrase = " ".join(seq)
            # Avoid single standalone "a"
            if phrase.lower() != "a":
                try:
                    num_val = float(w2n.word_to_num(phrase))
                    # Find span in text
                    m = re.search(r"\b" + re.escape(phrase) + r"\b", text, re.IGNORECASE)
                    if m:
                        start_idx = m.start()
                        end_idx = m.end()
                        span = (start_idx, end_idx)
                        if not any(s[0] <= start_idx and end_idx <= s[1] for s in seen_spans):
                            seen_spans.add(span)
                            unit = extract_unit_context(text, end_idx)
                            results.append({
                                "raw": phrase,
                                "value": num_val,
                                "unit": unit or "count",
                                "span": span
                            })
                except Exception:
                    pass
            i = j
        else:
            i += 1

    # Sort results by occurrence in text
    results.sort(key=lambda x: x["span"][0])
    return results

