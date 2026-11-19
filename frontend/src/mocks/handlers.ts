/**
 * frontend/src/mocks/handlers.ts
 *
 * MSW v2 mock handlers loading official fixtures from shared/fixtures.
 * Active ONLY when VITE_USE_MOCKS=true.
 */

import { http, HttpResponse } from "msw";
import mockCaseFixture from "./fixtures/mock_case.json";
import mockObservationsFixture from "./fixtures/mock_observations.json";
import mockGraphFixture from "./fixtures/mock_graph.json";
import mockTimelineFixture from "./fixtures/mock_timeline.json";

// In-memory clone of fixtures so mock modifications persist during session
let currentCase = JSON.parse(JSON.stringify(mockCaseFixture));
let currentObservations = JSON.parse(JSON.stringify(mockObservationsFixture));
let currentGraph = JSON.parse(JSON.stringify(mockGraphFixture));
let currentTimeline = JSON.parse(JSON.stringify(mockTimelineFixture));
let currentReviews: any[] = [
  {
    id: "rev_seed_01",
    case_id: "case_campus_tech_fest_2026",
    target_id: "obs_audio_disc_01",
    target_type: "observation",
    decision: "confirmed",
    notes: "Acoustic noise jump confirmed at 7400ms matching stage microphone bump or cut.",
    reviewer: "lead_analyst",
    created_at: "2026-11-19T09:15:00Z",
  },
];

export const handlers = [
  // Health
  http.get("/api/health", () => {
    return HttpResponse.json({
      status: "ok",
      app: "TruthLens X (Mock Service Worker)",
      offline: true,
      cpu_only: true,
      mock_active: true,
    });
  }),

  // Cases List
  http.get("/api/cases", () => {
    return HttpResponse.json({
      cases: [currentCase.case],
      total: 1,
    });
  }),

  // Create Case
  http.post("/api/cases", async ({ request }) => {
    const body = (await request.json()) as any;
    const newCaseId = `case_mock_${Date.now()}`;
    const newCase = {
      id: newCaseId,
      title: body.title || "Untitled Mock Case",
      description: body.description || body.notes || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      evidence_count: 0,
      status: "created",
    };
    currentCase = {
      case: newCase,
      evidence_items: [],
      observation_count: 0,
      claim_count: 0,
      contradiction_count: 0,
    };
    return HttpResponse.json(newCase);
  }),

  // Get Case Details
  http.get("/api/cases/:caseId", ({ params }) => {
    return HttpResponse.json(currentCase);
  }),

  // Upload Evidence
  http.post("/api/cases/:caseId/evidence", async ({ request, params }) => {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const sourceNote = (formData.get("source_note") as string) || "";
    const filename = file ? file.name : "uploaded_mock.jpg";
    const sha256 = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945";
    const evidenceId = `ev_mock_${Date.now().toString(16).slice(-6)}`;

    const newEvidence = {
      id: evidenceId,
      case_id: params.caseId as string,
      filename,
      original_name: filename,
      sha256,
      modality: filename.endsWith(".mp4") ? "video" : filename.endsWith(".wav") ? "audio" : "image",
      kind: filename.endsWith(".mp4") ? "video" : filename.endsWith(".wav") ? "audio" : "image",
      mime_type: filename.endsWith(".mp4") ? "video/mp4" : filename.endsWith(".wav") ? "audio/wav" : "image/jpeg",
      file_size_bytes: file ? file.size : 102400,
      file_path: `data/evidence/${params.caseId}/${sha256}.bin`,
      created_at: new Date().toISOString(),
      source_note: sourceNote,
      metadata: {},
    };

    currentCase.evidence_items.push(newEvidence);
    currentCase.case.evidence_count = currentCase.evidence_items.length;
    currentCase.case.status = "ingested";

    return HttpResponse.json({
      evidence: newEvidence,
      message: "Evidence ingested and stored in read-only repository (MOCK).",
    });
  }),

  // Ingest Caption
  http.post("/api/cases/:caseId/caption", async ({ request, params }) => {
    const body = (await request.json()) as any;
    const captionId = `ev_cap_${Date.now().toString(16).slice(-6)}`;
    return HttpResponse.json({
      id: captionId,
      case_id: params.caseId as string,
      text: body.text,
      source: body.source || "social_post",
      created_at: new Date().toISOString(),
    });
  }),

  // Trigger Analysis
  http.post("/api/cases/:caseId/analyze", ({ params }) => {
    currentCase.case.status = "correlated";
    return HttpResponse.json({
      message: "Analysis completed (MOCK).",
      case_id: params.caseId,
      status: "correlated",
      evidence_processed: currentCase.evidence_items.length,
      errors: [],
    });
  }),

  // Status
  http.get("/api/cases/:caseId/status", ({ params }) => {
    return HttpResponse.json({
      case_id: params.caseId as string,
      status: currentCase.case.status === "correlated" ? "completed" : "idle",
      progress_percent: 100.0,
      current_step: `Status: ${currentCase.case.status}`,
      errors: [],
    });
  }),

  // Observations
  http.get("/api/cases/:caseId/observations", ({ request }) => {
    const url = new URL(request.url);
    const modality = url.searchParams.get("modality");
    if (modality) {
      return HttpResponse.json(
        currentObservations.filter((obs: any) => obs.modality === modality)
      );
    }
    return HttpResponse.json(currentObservations);
  }),

  // Claims
  http.get("/api/cases/:caseId/claims", () => {
    return HttpResponse.json([
      {
        id: "claim_01",
        case_id: currentCase.case.id,
        source_evidence_id: "ev_text_caption_04",
        source_kind: "caption",
        text: "Record turnout: 3,000 attendees gathered at Main Plaza for Tech Fest 2026!",
        claim_type: "number_attendance",
        value: { count: 3000, entity: "attendees" },
      },
      {
        id: "claim_02",
        case_id: currentCase.case.id,
        source_evidence_id: "ev_audio_speech_03",
        source_kind: "transcript",
        text: "We have about three hundred attendees gathered here today at the Main Plaza.",
        claim_type: "number_attendance",
        value: { count: 300, entity: "attendees" },
        time_start_ms: 5200,
        time_end_ms: 7200,
      },
    ]);
  }),

  // Graph
  http.get("/api/cases/:caseId/graph", () => {
    return HttpResponse.json(currentGraph);
  }),

  // Timeline
  http.get("/api/cases/:caseId/timeline", () => {
    return HttpResponse.json(currentTimeline);
  }),

  // Verify Hash
  http.post("/api/evidence/:evidenceId/verify-hash", ({ params }) => {
    return HttpResponse.json({
      evidence_id: params.evidenceId,
      expected_sha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
      actual_sha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
      match: true,
    });
  }),

  // Delete Evidence
  http.delete("/api/evidence/:evidenceId", ({ params }) => {
    currentCase.evidence_items = currentCase.evidence_items.filter(
      (e: any) => e.id !== params.evidenceId
    );
    currentCase.case.evidence_count = currentCase.evidence_items.length;
    return HttpResponse.json({
      deleted: true,
      evidence_id: params.evidenceId,
    });
  }),

  // Review Observation
  http.post("/api/observations/:id/review", async ({ request, params }) => {
    const body = (await request.json()) as any;
    const newRev = {
      id: `rev_mock_${Date.now()}`,
      case_id: currentCase.case.id,
      target_id: params.id as string,
      target_type: "observation",
      decision: body.decision,
      notes: body.note || body.notes || "",
      reviewer: body.reviewer || "analyst",
      created_at: new Date().toISOString(),
    };
    currentReviews.unshift(newRev);
    return HttpResponse.json(newRev);
  }),

  // Get Reviews for Observation
  http.get("/api/observations/:id/reviews", ({ params }) => {
    const filtered = currentReviews.filter((r) => r.target_id === params.id);
    return HttpResponse.json({
      reviews: filtered,
      total: filtered.length,
    });
  }),

  // Get Reviews for Case
  http.get("/api/cases/:caseId/reviews", () => {
    return HttpResponse.json({
      reviews: currentReviews,
      total: currentReviews.length,
    });
  }),

  // Audit
  http.get("/api/cases/:caseId/audit", ({ params }) => {
    return HttpResponse.json({
      case_id: params.caseId,
      verification: { valid: true, count: 4, errors: [] },
      entries: [
        {
          id: 1,
          case_id: params.caseId,
          ts: "2026-11-19T08:00:00Z",
          actor: "analyst",
          action: "CREATE_CASE",
          target: params.caseId,
          details: { title: currentCase.case.title },
          prev_hash: "GENESIS",
          entry_hash: "mock_hash_01",
        },
      ],
    });
  }),

  // Generate Report
  http.post("/api/cases/:caseId/report", ({ params }) => {
    const reportId = `rep_mock_${Date.now().toString(16).slice(-8)}`;
    currentCase.case.status = "reported";
    return HttpResponse.json({
      report_id: reportId,
      case_id: params.caseId,
      generated_at: new Date().toISOString(),
      format: "json",
      pdf_url: `/api/reports/${reportId}.pdf`,
      json_url: `/api/reports/${reportId}.json`,
      report_json_sha256: "8e75b7501a4e1564478d1f2a35368a1d749cf1a1cb27f0ef622143bc3262ad01",
      download_url: `/api/reports/${reportId}.json`,
      report_json: {
        report_id: reportId,
        case_id: params.caseId,
        report_json_sha256: "8e75b7501a4e1564478d1f2a35368a1d749cf1a1cb27f0ef622143bc3262ad01",
        report_meta: {
          generated_at: new Date().toISOString(),
        },
      },
    });
  }),

  // Artifact file mock
  http.get("/api/artifacts/:artifactId", () => {
    return HttpResponse.json({
      buckets: Array.from({ length: 120 }, (_, i) => ({
        min: -Math.abs(Math.sin(i * 0.15) * 0.5),
        max: Math.abs(Math.cos(i * 0.2) * 0.6),
      })),
      duration_ms: 15200,
    });
  }),

  // Evidence file mock download
  http.get("/api/evidence/:evidenceId/file", () => {
    return new HttpResponse(new Blob(["mock binary evidence"]), {
      headers: { "Content-Type": "application/octet-stream" },
    });
  }),
];
