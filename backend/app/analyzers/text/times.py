"""backend/app/analyzers/text/times.py

Forensic date, time, weekday, and daypart extraction for TruthLens X.
Detects:
- Exact times ("6:30 PM", "14:45", "8 am")
- Weekdays ("Monday", "Saturday", "Friday afternoon")
- Dayparts ("morning", "afternoon", "evening", "night")
- Dates ("2024-05-12", "May 10th", "05/06")
- Ambiguity flag for slash dates where both day and month <= 12 ("05/06")
"""

import datetime
import re
from typing import Any, Dict, List, Optional, Tuple


WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6
}

DAYPARTS = {
    "morning": "morning",
    "afternoon": "afternoon",
    "evening": "evening",
    "night": "night",
    "noon": "afternoon",
    "midnight": "night",
    "dawn": "morning",
    "dusk": "evening"
}

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "aug": 8, "sep": 9,
    "oct": 10, "nov": 11, "dec": 12
}


def parse_time_of_day(time_str: str) -> Optional[Tuple[int, int]]:
    """Parses 12h or 24h time strings like '6:30 PM', '14:45', '8 am' into (hour, minute)."""
    m = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?", time_str, re.IGNORECASE)
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2)) if m.group(2) else 0
    meridiem = m.group(3).lower().replace(".", "") if m.group(3) else None

    if meridiem == "pm" and hour < 12:
        hour += 12
    elif meridiem == "am" and hour == 12:
        hour = 0

    if 0 <= hour <= 23 and 0 <= minute <= 59:
        return (hour, minute)
    return None


def extract_times(text: str) -> List[Dict[str, Any]]:
    """
    Extracts dates, times, weekdays, and dayparts from text.
    Marks ambiguous dates (e.g. 05/06).
    """
    results: List[Dict[str, Any]] = []
    if not text:
        return results

    seen_spans = set()

    # 1. Combined Weekday + Time/Daypart: "Saturday 6:30 PM", "Friday afternoon"
    combined_pattern = re.compile(
        r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)"
        r"(?:\s+(morning|afternoon|evening|night))?"
        r"(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)))?",
        re.IGNORECASE
    )
    for m in combined_pattern.finditer(text):
        raw = m.group(0).strip()
        weekday = m.group(1).capitalize()
        daypart = m.group(2).lower() if m.group(2) else None
        time_part = m.group(3)

        hour, minute = None, None
        if time_part:
            parsed_time = parse_time_of_day(time_part)
            if parsed_time:
                hour, minute = parsed_time
                if not daypart:
                    if 5 <= hour < 12:
                        daypart = "morning"
                    elif 12 <= hour < 17:
                        daypart = "afternoon"
                    elif 17 <= hour < 21:
                        daypart = "evening"
                    else:
                        daypart = "night"

        span = (m.start(), m.end())
        seen_spans.add(span)
        results.append({
            "raw": raw,
            "weekday": weekday,
            "daypart": daypart,
            "time": f"{hour:02d}:{minute:02d}" if hour is not None else None,
            "hour": hour,
            "minute": minute,
            "ambiguous": False,
            "span": span
        })

    # 2. Standalone exact times: "6:30 PM", "14:00", "8:15 am"
    time_pattern = re.compile(r"\b(\d{1,2}:\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)?|\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.))\b", re.IGNORECASE)
    for m in time_pattern.finditer(text):
        if any(s[0] <= m.start() and m.end() <= s[1] for s in seen_spans):
            continue
        parsed_time = parse_time_of_day(m.group(0))
        if parsed_time:
            hour, minute = parsed_time
            daypart = "morning" if 5 <= hour < 12 else "afternoon" if 12 <= hour < 17 else "evening" if 17 <= hour < 21 else "night"
            span = (m.start(), m.end())
            seen_spans.add(span)
            results.append({
                "raw": m.group(0),
                "weekday": None,
                "daypart": daypart,
                "time": f"{hour:02d}:{minute:02d}",
                "hour": hour,
                "minute": minute,
                "ambiguous": False,
                "span": span
            })

    # 3. Numeric slash / dash dates: "05/06", "05/06/2024", "2024-05-12"
    slash_pattern = re.compile(r"\b(\d{1,4})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b")
    for m in slash_pattern.finditer(text):
        if any(s[0] <= m.start() and m.end() <= s[1] for s in seen_spans):
            continue
        part1 = int(m.group(1))
        part2 = int(m.group(2))
        part3 = int(m.group(3)) if m.group(3) else None

        # Check ISO format: YYYY-MM-DD
        if part1 > 31 and part2 <= 12 and part3 and part3 <= 31:
            year, month, day = part1, part2, part3
            ambiguous = False
            iso = f"{year:04d}-{month:02d}-{day:02d}"
        elif part3 is not None:
            # DD/MM/YYYY or MM/DD/YYYY
            year = part3 if part3 > 99 else 2000 + part3
            ambiguous = (part1 <= 12 and part2 <= 12 and part1 != part2)
            iso = f"{year:04d}-{part1:02d}-{part2:02d}"  # Default order
        else:
            # Two components like "05/06" (month/day or day/month)
            ambiguous = (part1 <= 12 and part2 <= 12)
            iso = f"XXXX-{part1:02d}-{part2:02d}"

        span = (m.start(), m.end())
        seen_spans.add(span)
        results.append({
            "raw": m.group(0),
            "date": iso,
            "weekday": None,
            "daypart": None,
            "time": None,
            "ambiguous": ambiguous,
            "span": span
        })

    # 4. Named month dates: "May 10th", "12 October 2023"
    named_pattern = re.compile(
        r"\b(?:(\d{1,2})(?:st|nd|rd|th)?\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)"
        r"(?:\s+(\d{1,2})(?:st|nd|rd|th)?)?(?:,?\s+(\d{4}))?\b",
        re.IGNORECASE
    )
    for m in named_pattern.finditer(text):
        if any(s[0] <= m.start() and m.end() <= s[1] for s in seen_spans):
            continue
        m_str = m.group(2).lower()
        month = MONTHS.get(m_str)
        day_str = m.group(1) or m.group(3)
        day = int(day_str) if day_str else None
        year = int(m.group(4)) if m.group(4) else None

        if month:
            iso = f"{year:04d}" if year else "XXXX"
            iso += f"-{month:02d}"
            if day:
                iso += f"-{day:02d}"

            span = (m.start(), m.end())
            seen_spans.add(span)
            results.append({
                "raw": m.group(0).strip(),
                "date": iso,
                "weekday": None,
                "daypart": None,
                "time": None,
                "ambiguous": False,
                "span": span
            })

    # 5. Standalone dayparts: "morning", "afternoon", "evening", "night"
    daypart_pattern = re.compile(r"\b(morning|afternoon|evening|night|noon|midnight)\b", re.IGNORECASE)
    for m in daypart_pattern.finditer(text):
        if any(s[0] <= m.start() and m.end() <= s[1] for s in seen_spans):
            continue
        dp = DAYPARTS.get(m.group(1).lower())
        span = (m.start(), m.end())
        seen_spans.add(span)
        results.append({
            "raw": m.group(0),
            "weekday": None,
            "daypart": dp,
            "time": None,
            "ambiguous": False,
            "span": span
        })

    results.sort(key=lambda x: x["span"][0])
    return results

