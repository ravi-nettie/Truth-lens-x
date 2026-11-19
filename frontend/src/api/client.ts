/**
 * frontend/src/api/client.ts
 *
 * Typed API Client for TruthLens X with standardized ErrorResponse envelope handling.
 */

import type { components, paths } from "./generated";

export type SchemaCaseResponse = components["schemas"]["CaseResponse"];
export type SchemaCaseListResponse = components["schemas"]["CaseListResponse"];
export type SchemaCaseDetailResponse = components["schemas"]["CaseDetailResponse"];
export type SchemaEvidenceResponse = components["schemas"]["EvidenceResponse"];
export type SchemaEvidenceUploadResponse = components["schemas"]["EvidenceUploadResponse"];
export type SchemaObservation = components["schemas"]["Observation"];
export interface SchemaClaim {
  id: string;
  case_id: string;
  source_evidence_id: string;
  source_kind: string;
  text: string;
  claim_type: string;
  value: Record<string, any>;
  time_start_ms?: number | null;
  time_end_ms?: number | null;
}
export type SchemaGraphResponse = components["schemas"]["GraphResponse"];
export type SchemaTimelineResponse = components["schemas"]["TimelineResponse"];
export type SchemaTimelineEvent = components["schemas"]["TimelineEvent"];
export type SchemaAnalysisStatusResponse = components["schemas"]["AnalysisStatusResponse"];
export type SchemaReviewResponse = components["schemas"]["ReviewResponse"];
export interface SchemaReportResponse {
  report_id?: string;
  case_id: string;
  generated_at: string;
  format: string;
  pdf_url?: string | null;
  json_url?: string | null;
  report_json_sha256?: string | null;
  report_json?: Record<string, any> | null;
  download_url?: string | null;
}

export interface SchemaErrorDetail {
  code: string;
  message: string;
  detail?: any;
}

export interface SchemaErrorResponse {
  error: SchemaErrorDetail;
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  detail: any;

  constructor(status: number, code: string, message: string, detail?: any) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : endpoint;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorCode = "UNKNOWN_ERROR";
    let errorMessage = `Request failed with status ${response.status}`;
    let errorDetail = null;

    try {
      const errJson = await response.json();
      if (errJson.error) {
        errorCode = errJson.error.code || errorCode;
        errorMessage = errJson.error.message || errorMessage;
        errorDetail = errJson.error.detail || null;
      } else if (errJson.detail) {
        errorMessage = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // Non-JSON error body
      errorMessage = await response.text().catch(() => errorMessage);
    }

    throw new ApiClientError(response.status, errorCode, errorMessage, errorDetail);
  }

  // Handle empty responses
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return {} as T;
}

export const api = {
  // Health
  getHealth: () => request<{ status: string; offline: boolean; cpu_only: boolean }>("/api/health"),

  // Cases
  getCases: () => request<SchemaCaseListResponse>("/api/cases"),
  createCase: (data: { title: string; description?: string; notes?: string }) =>
    request<SchemaCaseResponse>("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  getCase: (caseId: string) => request<SchemaCaseDetailResponse>(`/api/cases/${caseId}`),
  deleteCase: (caseId: string) =>
    request<{ deleted: boolean; case_id: string }>(`/api/cases/${caseId}`, { method: "DELETE" }),

  // Evidence
  uploadEvidence: async (caseId: string, file: File, sourceNote: string = "") => {
    const formData = new FormData();
    formData.append("file", file);
    if (sourceNote) {
      formData.append("source_note", sourceNote);
    }
    return request<SchemaEvidenceUploadResponse>(`/api/cases/${caseId}/evidence`, {
      method: "POST",
      body: formData,
    });
  },
  addCaption: (caseId: string, text: string, source: string = "social_post") =>
    request<{ id: string; case_id: string; text: string; source: string; created_at: string }>(
      `/api/cases/${caseId}/caption`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, text, source }),
      }
    ),
  verifyEvidenceHash: (evidenceId: string) =>
    request<{ evidence_id: string; expected_sha256: string; actual_sha256: string; match: boolean }>(
      `/api/evidence/${evidenceId}/verify-hash`,
      { method: "POST" }
    ),
  deleteEvidence: (evidenceId: string, confirm: boolean = true) =>
    request<{ deleted: boolean; evidence_id: string }>(
      `/api/evidence/${evidenceId}?confirm=${confirm}`,
      { method: "DELETE" }
    ),

  // Analysis & Status
  triggerAnalysis: (caseId: string, sync: boolean = false) =>
    request<{ message: string; case_id: string; status: string }>(
      `/api/cases/${caseId}/analyze?sync=${sync}`,
      { method: "POST" }
    ),
  getCaseStatus: (caseId: string) => request<SchemaAnalysisStatusResponse>(`/api/cases/${caseId}/status`),

  // Observations, Graph, Timeline, Audit
  getObservations: (caseId: string, modality?: string) =>
    request<SchemaObservation[]>(
      `/api/cases/${caseId}/observations${modality ? `?modality=${modality}` : ""}`
    ),
  getClaims: (caseId: string) => request<SchemaClaim[]>(`/api/cases/${caseId}/claims`),
  getGraph: (caseId: string) => request<SchemaGraphResponse>(`/api/cases/${caseId}/graph`),
  getTimeline: (caseId: string) => request<SchemaTimelineResponse>(`/api/cases/${caseId}/timeline`),
  getAudit: (caseId: string) =>
    request<{ case_id: string; verification: { valid: boolean; count: number; errors: string[] }; entries: any[] }>(
      `/api/cases/${caseId}/audit`
    ),

  // Review Decisions
  reviewObservation: (targetId: string, review: { decision: string; note: string; reviewer?: string }) =>
    request<SchemaReviewResponse>(`/api/observations/${targetId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...review, notes: review.note }),
    }),
  getObservationReviews: (observationId: string) =>
    request<{ reviews: SchemaReviewResponse[]; total: number }>(`/api/observations/${observationId}/reviews`),
  getCaseReviews: (caseId: string) =>
    request<{ reviews: SchemaReviewResponse[]; total: number }>(`/api/cases/${caseId}/reviews`),

  // Reports
  getReport: (caseId: string) => request<SchemaReportResponse>(`/api/cases/${caseId}/report`),
  generateReport: (caseId: string, format: string = "json") =>
    request<SchemaReportResponse>(`/api/cases/${caseId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    }),
};
