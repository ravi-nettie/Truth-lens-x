"""backend/tests/unit/test_text_parsers.py

Unit tests for TruthLens X Text & Context Analysis (Module 13D).
Covers at least 30 distinct test cases:
1. Number parsing: spelled-out, comma-separated, metric shorthand, percentages, currency
2. Date & time parsing: exact times, weekdays, dayparts, ISO dates, ambiguous dates (e.g. 05/06)
3. Named Entity Recognition: PERSON, ORG, GPE, EVENT
4. Caption vs. Transcript comparison: numerical mismatch, temporal mismatch, entity conflict, TF-IDF
5. Hard rule validation: text-only observations cap at moderate strength
"""

import pytest
from shared.schemas import AnalysisContext, Claim, Modality, Strength
from backend.app.analyzers.text.numbers import extract_numbers
from backend.app.analyzers.text.times import extract_times
from backend.app.analyzers.text.entities import extract_entities
from backend.app.analyzers.text.claims import text_to_claims
from backend.app.analyzers.text.compare import (
    compare_caption_and_transcript,
    compute_tfidf_cosine_similarity
)
from backend.app.analyzers.text.run import analyze


# ============================================================================
# 1. Number Parsing Tests (10 tests)
# ============================================================================

def test_number_spelled_out_three_hundred():
    res = extract_numbers("Over three hundred people attended.")
    assert len(res) >= 1
    assert res[0]["value"] == 300.0
    assert res[0]["unit"] == "people"


def test_number_spelled_out_twenty_five():
    res = extract_numbers("There were twenty five protesters outside.")
    assert len(res) >= 1
    assert res[0]["value"] == 25.0
    assert res[0]["unit"] == "people"


def test_number_comma_separated_3000():
    res = extract_numbers("Police reported 3,000 demonstrators.")
    assert len(res) >= 1
    assert res[0]["value"] == 3000.0
    assert res[0]["unit"] == "people"


def test_number_comma_separated_large():
    res = extract_numbers("Over 1,250,000 citizens voted in the election.")
    assert len(res) >= 1
    assert res[0]["value"] == 1250000.0
    assert res[0]["unit"] == "people"


def test_number_shorthand_3k():
    res = extract_numbers("About 3k supporters gathered at the square.")
    assert len(res) >= 1
    assert res[0]["value"] == 3000.0
    assert res[0]["unit"] == "people"


def test_number_shorthand_2_5m():
    res = extract_numbers("The budget exceeded 2.5m dollars.")
    assert len(res) >= 1
    assert res[0]["value"] == 2500000.0
    assert res[0]["unit"] == "currency"


def test_number_shorthand_10b():
    res = extract_numbers("A 10b investment was announced.")
    assert len(res) >= 1
    assert res[0]["value"] == 10000000000.0


def test_number_percentage():
    res = extract_numbers("Approval ratings dropped by 25% this month.")
    assert len(res) >= 1
    assert res[0]["value"] == 25.0
    assert res[0]["unit"] == "percent"


def test_number_currency_symbol():
    res = extract_numbers("Damages were estimated at $500.")
    assert len(res) >= 1
    assert res[0]["value"] == 500.0
    assert res[0]["unit"] == "currency"


def test_number_multiple_occurrences():
    res = extract_numbers("500 people marched for 10 miles with 15% turnout.")
    assert len(res) == 3
    vals = [r["value"] for r in res]
    assert 500.0 in vals
    assert 10.0 in vals
    assert 25.0 not in vals


# ============================================================================
# 2. Date and Time Parsing Tests (10 tests)
# ============================================================================

def test_time_saturday_6_30_pm():
    res = extract_times("The incident occurred on Saturday 6:30 PM.")
    assert len(res) >= 1
    t = res[0]
    assert t["weekday"] == "Saturday"
    assert t["time"] == "18:30"
    assert t["daypart"] == "evening"
    assert t["ambiguous"] is False


def test_time_friday_afternoon():
    res = extract_times("Protests erupted on Friday afternoon.")
    assert len(res) >= 1
    t = res[0]
    assert t["weekday"] == "Friday"
    assert t["daypart"] == "afternoon"
    assert t["ambiguous"] is False


def test_time_exact_24h():
    res = extract_times("The briefing concluded at 14:45.")
    assert len(res) >= 1
    assert res[0]["time"] == "14:45"
    assert res[0]["daypart"] == "afternoon"


def test_time_exact_morning_am():
    res = extract_times("Meeting scheduled for 8:15 am.")
    assert len(res) >= 1
    assert res[0]["time"] == "08:15"
    assert res[0]["daypart"] == "morning"


def test_time_ambiguous_slash_date():
    # 05/06 could be May 6 or June 5
    res = extract_times("The document was signed on 05/06.")
    assert len(res) >= 1
    assert res[0]["ambiguous"] is True


def test_time_unambiguous_slash_date():
    # 25/04 cannot be month 25
    res = extract_times("Published on 25/04/2023.")
    assert len(res) >= 1
    assert res[0]["ambiguous"] is False


def test_time_iso_date():
    res = extract_times("Recorded on 2024-05-12.")
    assert len(res) >= 1
    assert res[0]["date"] == "2024-05-12"
    assert res[0]["ambiguous"] is False


def test_time_named_month_may_10th():
    res = extract_times("Rally held on May 10th.")
    assert len(res) >= 1
    assert "05-10" in res[0]["date"]
    assert res[0]["ambiguous"] is False


def test_time_standalone_daypart_evening():
    res = extract_times("Explosions were heard late in the evening.")
    assert len(res) >= 1
    assert res[0]["daypart"] == "evening"


def test_time_standalone_daypart_midnight():
    res = extract_times("The curfew took effect at midnight.")
    assert len(res) >= 1
    assert res[0]["daypart"] == "night"


# ============================================================================
# 3. Named Entity Recognition Tests (5 tests)
# ============================================================================

def test_entity_person_extraction():
    entities, _ = extract_entities("Secretary John Kerry addressed the committee.")
    persons = [e["text"] for e in entities if e["label"] == "PERSON"]
    assert any("John Kerry" in p for p in persons)


def test_entity_organization_extraction():
    entities, _ = extract_entities("Statements were released by the United Nations and NATO.")
    orgs = [e["text"].lower() for e in entities if e["label"] == "ORG"]
    assert any("nato" in o or "united nations" in o for o in orgs)


def test_entity_gpe_location_extraction():
    entities, _ = extract_entities("Delegates arrived in Washington from France and Germany.")
    gpes = [e["text"].lower() for e in entities if e["label"] in ("GPE", "LOC")]
    assert any("washington" in g or "france" in g or "germany" in g for g in gpes)


def test_entity_event_extraction():
    entities, _ = extract_entities("Athletes prepared for the World Cup in Qatar.")
    events = [e["text"].lower() for e in entities if e["label"] == "EVENT"]
    assert any("world cup" in ev for ev in events)


def test_entity_claim_synthesis():
    claims = text_to_claims("case_test", "ev_test", "President Emmanuel Macron visited Berlin.")
    ent_claims = [c for c in claims if c.claim_type == "entity"]
    assert len(ent_claims) >= 1
    names = [c.text for c in ent_claims]
    assert any("Macron" in n or "Berlin" in n for n in names)


# ============================================================================
# 4. Caption vs. Transcript Comparison Tests (7 tests)
# ============================================================================

def test_caption_number_mismatch_moderate():
    # Caption claims 3000 people, spoken audio transcript states three hundred (300)
    caption = "Massive rally of 3,000 protesters outside city hall."
    transcript = "We estimate approximately three hundred protesters gathered here."

    c_claims = text_to_claims("case_1", "ev_1", caption, "caption")
    t_claims = text_to_claims("case_1", "ev_1", transcript, "transcript")

    obs, meta = compare_caption_and_transcript("case_1", "ev_1", caption, transcript, c_claims, t_claims)

    mismatch_obs = next((o for o in obs if o.indicator == "caption_number_mismatch"), None)
    assert mismatch_obs is not None
    assert mismatch_obs.evidence_strength == Strength.moderate
    # Quotes exact spans from both caption and transcript
    assert "3,000" in mismatch_obs.explanation
    assert "three hundred" in mismatch_obs.explanation
    assert len(mismatch_obs.alternative_explanation) > 0
    assert len(mismatch_obs.limitations) > 0


def test_caption_time_mismatch_weekday():
    # Saturday vs Friday conflict
    caption = "Crowds gathered on Saturday 6:30 PM."
    transcript = "The event took place on Friday afternoon."

    c_claims = text_to_claims("case_2", "ev_2", caption, "caption")
    t_claims = text_to_claims("case_2", "ev_2", transcript, "transcript")

    obs, _ = compare_caption_and_transcript("case_2", "ev_2", caption, transcript, c_claims, t_claims)

    time_obs = next((o for o in obs if o.indicator == "caption_time_mismatch"), None)
    assert time_obs is not None
    assert time_obs.evidence_strength == Strength.moderate
    assert "Saturday" in time_obs.explanation
    assert "Friday" in time_obs.explanation


def test_caption_time_mismatch_hour():
    # 14:00 vs 18:00 (> 30 min difference)
    caption = "The press conference started at 2:00 PM."
    transcript = "Good evening, starting our briefing here at 6:00 PM."

    c_claims = text_to_claims("case_3", "ev_3", caption, "caption")
    t_claims = text_to_claims("case_3", "ev_3", transcript, "transcript")

    obs, _ = compare_caption_and_transcript("case_3", "ev_3", caption, transcript, c_claims, t_claims)

    time_obs = next((o for o in obs if o.indicator == "caption_time_mismatch"), None)
    assert time_obs is not None
    assert time_obs.evidence_strength == Strength.moderate


def test_caption_entity_absent_informational():
    caption = "Protest led by activist Sarah Connor in downtown."
    transcript = "The crowd cheered as the march proceeded down the boulevard."

    c_claims = text_to_claims("case_4", "ev_4", caption, "caption")
    t_claims = text_to_claims("case_4", "ev_4", transcript, "transcript")

    obs, _ = compare_caption_and_transcript("case_4", "ev_4", caption, transcript, c_claims, t_claims)

    absent_obs = next((o for o in obs if o.indicator == "caption_entity_absent_from_audio"), None)
    assert absent_obs is not None
    # Rule 2: Entity absent alone MUST be informational
    assert absent_obs.evidence_strength == Strength.informational


def test_tfidf_cosine_similarity_calculation():
    text1 = "peaceful demonstration in the capital city"
    text2 = "demonstration held peacefully in the capital"
    sim = compute_tfidf_cosine_similarity(text1, text2)
    assert 0.4 <= sim <= 1.0


def test_tfidf_observation_reported_with_no_verdict():
    caption = "President speaking at summit"
    transcript = "President speaking at international summit"
    c_claims = text_to_claims("case_5", "ev_5", caption, "caption")
    t_claims = text_to_claims("case_5", "ev_5", transcript, "transcript")

    obs, meta = compare_caption_and_transcript("case_5", "ev_5", caption, transcript, c_claims, t_claims)

    tfidf_obs = next((o for o in obs if o.indicator == "text_similarity_tfidf"), None)
    assert tfidf_obs is not None
    assert tfidf_obs.evidence_strength == Strength.informational
    assert "no automated verdict" in tfidf_obs.explanation.lower()


def test_text_analyzer_run_pipeline():
    ctx = AnalysisContext(case_id="case_full_text", work_dir=".", artifact_dir=".")
    evidence = {
        "id": "ev_txt_1",
        "text": "Over 5,000 citizens rallied on Saturday morning in Paris.",
        "transcript": "Local news reported about 500 citizens rallied on Friday evening in London."
    }

    result = analyze(evidence, ctx)
    assert result.status == "done"
    assert len(result.claims) >= 3

    # Hard cap check: Rule 2 specifies text observations cap at moderate
    for obs in result.observations:
        assert obs.evidence_strength in (Strength.informational, Strength.weak, Strength.moderate)
        assert obs.evidence_strength != Strength.strong

