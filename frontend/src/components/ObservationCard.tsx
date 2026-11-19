import React, { useEffect, useState } from "react";
import { Check, X, HelpCircle, AlertCircle, Sparkles, ChevronDown, ChevronUp, History as HistoryIcon, Clock } from "lucide-react";
import { api, SchemaObservation, SchemaReviewResponse } from "../api/client";
import { StrengthBadge } from "./StrengthBadge";

interface ObservationCardProps {
  observation: SchemaObservation;
  onReviewed?: () => void;
  isHighlighted?: boolean;
}

export const ObservationCard: React.FC<ObservationCardProps> = ({ observation, onReviewed, isHighlighted }) => {
  const [reviewNote, setReviewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviews, setReviews] = useState<SchemaReviewResponse[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchReviews = async () => {
    try {
      const res = await api.getObservationReviews(observation.id);
      setReviews(res.reviews || []);
    } catch {
      // Non-critical if reviews cannot be fetched
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [observation.id]);

  const latestReview = reviews.length > 0 ? reviews[0] : null;

  const handleReview = async (decision: "confirmed" | "dismissed" | "inconclusive") => {
    if (!reviewNote.trim()) {
      setErrorMsg("Please provide a brief justification note before submitting review.");
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await api.reviewObservation(observation.id, {
        decision,
        note: reviewNote.trim(),
        reviewer: "analyst",
      });
      setReviewSuccess(`Decision '${decision}' logged into audit trail.`);
      setReviewNote("");
      await fetchReviews();
      if (onReviewed) onReviewed();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit review verdict.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
            <Check className="h-3 w-3 text-emerald-600" /> Confirmed
          </span>
        );
      case "dismissed":
        return (
          <span className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-rose-700">
            <X className="h-3 w-3 text-rose-600" /> Dismissed
          </span>
        );
      case "inconclusive":
        return (
          <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            <HelpCircle className="h-3 w-3 text-amber-600" /> Needs Work
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
            {decision}
          </span>
        );
    }
  };

  return (
    <div
      id={`obs-${observation.id}`}
      className={`rounded-lg border transition-all p-5 shadow-sm bg-white ${
        isHighlighted
          ? "border-primary ring-2 ring-primary/20 shadow-md"
          : "border-outline-variant/60 hover:border-slate-300 hover:shadow"
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-[11px] font-semibold text-primary bg-[#EFF6FF] border border-blue-200 px-2 py-0.5 rounded">
              {observation.indicator}
            </span>
            <span className="text-xs text-on-surface-variant font-mono">
              via {observation.method}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ID: {observation.id}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-on-surface leading-snug">
            {observation.summary}
          </h4>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {latestReview && getDecisionBadge(latestReview.decision)}
          <StrengthBadge strength={observation.evidence_strength} />
          {observation.model_score !== null && observation.model_score !== undefined && (
            <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-[#FFF5E6] px-2 py-0.5 text-[11px] font-medium text-[#D97706]">
              <Sparkles className="h-3 w-3" />
              Uncalibrated Model Output ({observation.model_score.toFixed(2)})
            </span>
          )}
        </div>
      </div>

      {/* Explanation */}
      <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
        {observation.explanation}
      </p>

      {/* Callouts: Alternative Explanation & Limitations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {observation.alternative_explanation && (
          <div className="rounded border border-[rgba(217,119,6,0.3)] bg-[#FFF5E6] p-3 text-xs">
            <span className="block font-semibold text-[#D97706] uppercase tracking-wider text-[10px] mb-1">
              Alternative Explanation (Benign Potential)
            </span>
            <p className="text-slate-800 leading-relaxed">
              {observation.alternative_explanation}
            </p>
          </div>
        )}

        {observation.limitations && (
          <div className="rounded border border-outline-variant bg-surface-container-low p-3 text-xs">
            <span className="block font-semibold text-on-surface-variant uppercase tracking-wider text-[10px] mb-1">
              Forensic Limitations & Bounds
            </span>
            <p className="text-on-surface-variant leading-relaxed">
              {observation.limitations}
            </p>
          </div>
        )}
      </div>

      {/* Media Offsets or Region */}
      {(observation.time_start_ms !== null || observation.region) && (
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-on-surface-variant mb-4 pb-3 border-b border-outline-variant/60">
          {observation.time_start_ms !== null && (
            <span>
              Offset: {observation.time_start_ms} ms
              {observation.time_end_ms ? ` – ${observation.time_end_ms} ms` : ""}
            </span>
          )}
          {observation.region && (
            <span>
              ROI: [x={observation.region.x}, y={observation.region.y}, w={observation.region.w}, h={observation.region.h}]
            </span>
          )}
        </div>
      )}

      {/* Human Review Actions */}
      <div className="pt-3 border-t border-outline-variant/60">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
            Reviewer Action & Audit Justification
          </label>
          {reviews.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-[11px] text-primary hover:text-blue-800 flex items-center gap-1 font-medium transition-colors"
            >
              <HistoryIcon className="h-3 w-3" />
              <span>History ({reviews.length})</span>
              {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Enter justification note for this determination..."
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            disabled={isSubmitting}
            className="flex-1 bg-surface-container-lowest border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleReview("confirmed")}
              disabled={isSubmitting}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded shadow-sm disabled:opacity-50 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Confirm</span>
            </button>
            <button
              type="button"
              onClick={() => handleReview("dismissed")}
              disabled={isSubmitting}
              className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-1.5 rounded shadow-sm disabled:opacity-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              <span>Dismiss</span>
            </button>
            <button
              type="button"
              onClick={() => handleReview("inconclusive")}
              disabled={isSubmitting}
              className="flex items-center gap-1 bg-[#475569] hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded shadow-sm disabled:opacity-50 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Needs More Work</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {errorMsg}
          </p>
        )}
        {reviewSuccess && (
          <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
            <Check className="h-3.5 w-3.5" />
            {reviewSuccess}
          </p>
        )}

        {/* Expandable Append-Only Review History */}
        {showHistory && reviews.length > 0 && (
          <div className="mt-3 rounded border border-outline-variant bg-surface-container-low p-3 space-y-2">
            <h5 className="text-[11px] font-semibold text-on-surface flex items-center gap-1">
              <Clock className="h-3 w-3 text-on-surface-variant" /> Append-Only Review Audit Log
            </h5>
            <div className="divide-y divide-outline-variant/60">
              {reviews.map((rev) => (
                <div key={rev.id} className="pt-2 pb-1.5 first:pt-1 text-xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      {getDecisionBadge(rev.decision)}
                      <span className="text-on-surface-variant font-mono text-[11px]">by {rev.reviewer}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{rev.created_at}</span>
                  </div>
                  <p className="text-on-surface text-xs mt-1 pl-2 border-l-2 border-slate-300">
                    "{rev.notes}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
