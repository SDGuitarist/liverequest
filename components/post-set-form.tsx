"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PerformanceSession, OverallFeel } from "@/lib/supabase/types";
import { OVERALL_FEEL_VALUES, OVERALL_FEEL_LABEL } from "@/lib/supabase/types";

interface PostSetFormProps {
  session: PerformanceSession;
}

export function PostSetForm({ session }: PostSetFormProps) {
  const router = useRouter();
  const [setlistDeviations, setSetlistDeviations] = useState("");
  const [walkupCount, setWalkupCount] = useState(0);
  const [tipsReceived, setTipsReceived] = useState(false);
  const [staffFeedback, setStaffFeedback] = useState("");
  const [overallFeel, setOverallFeel] = useState<OverallFeel>("fine");
  const [complaintsReceived, setComplaintsReceived] = useState(false);
  const [observations, setObservations] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/session/submit-debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          debrief: {
            version: 1,
            setlist_deviations: setlistDeviations || null,
            walkup_count: walkupCount,
            tips_received: tipsReceived,
            staff_feedback: staffFeedback || null,
            overall_feel: overallFeel,
            complaints_received: complaintsReceived,
            observations: observations || null,
          },
        }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        setSubmitting(false);
      }
    } catch {
      setSubmitting(false);
    }
  }, [
    session.id,
    setlistDeviations,
    walkupCount,
    tipsReceived,
    staffFeedback,
    overallFeel,
    complaintsReceived,
    observations,
    router,
  ]);

  return (
    <div className="min-h-screen px-5 py-6">
      <h1 className="font-display text-title font-bold text-text-primary mb-1">
        Post-Set Debrief
      </h1>
      <p className="font-body text-caption text-text-secondary mb-6">
        Set {session.set_number} — {session.configuration}
      </p>

      {/* Overall Feel */}
      <div className="mb-5">
        <label className="block font-display text-caption font-bold text-text-secondary mb-2">
          Overall Set Feel
        </label>
        <div className="grid grid-cols-3 gap-2">
          {OVERALL_FEEL_VALUES.map((feel) => (
            <button
              key={feel}
              onClick={() => setOverallFeel(feel)}
              className={`py-3 rounded-lg font-display font-bold text-caption transition-colors ${
                overallFeel === feel
                  ? "bg-accent/15 text-accent border border-accent/20"
                  : "bg-surface-raised text-text-muted border border-white/[0.06] hover:text-text-secondary"
              }`}
            >
              {OVERALL_FEEL_LABEL[feel]}
            </button>
          ))}
        </div>
      </div>

      {/* Walkup Count */}
      <div className="mb-5">
        <label className="block font-display text-caption font-bold text-text-secondary mb-2">
          Walkup Count
        </label>
        <input
          type="number"
          min={0}
          value={walkupCount}
          onChange={(e) => setWalkupCount(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-full rounded-xl bg-surface-raised border border-white/[0.06] px-4 py-3 font-body text-body text-text-primary"
        />
      </div>

      {/* Toggle: Tips */}
      <div className="mb-5 flex items-center justify-between rounded-xl bg-surface-raised border border-white/[0.06] px-4 py-3">
        <span className="font-display text-caption font-bold text-text-secondary">Tips Received</span>
        <button
          onClick={() => setTipsReceived(!tipsReceived)}
          role="switch"
          aria-checked={tipsReceived}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            tipsReceived ? "bg-accent" : "bg-white/[0.1]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              tipsReceived ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {/* Toggle: Complaints */}
      <div className="mb-5 flex items-center justify-between rounded-xl bg-surface-raised border border-white/[0.06] px-4 py-3">
        <span className="font-display text-caption font-bold text-text-secondary">Complaints Received</span>
        <button
          onClick={() => setComplaintsReceived(!complaintsReceived)}
          role="switch"
          aria-checked={complaintsReceived}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            complaintsReceived ? "bg-red-500" : "bg-white/[0.1]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              complaintsReceived ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {/* Setlist Deviations */}
      <div className="mb-5">
        <label className="block font-display text-caption font-bold text-text-secondary mb-2">
          Setlist Deviations
        </label>
        <textarea
          rows={3}
          placeholder="What did you change from the planned setlist and why?"
          value={setlistDeviations}
          onChange={(e) => setSetlistDeviations(e.target.value)}
          className="w-full rounded-xl bg-surface-raised border border-white/[0.06] px-4 py-3 font-body text-body text-text-primary placeholder:text-text-muted resize-none"
        />
      </div>

      {/* Staff Feedback */}
      <div className="mb-5">
        <label className="block font-display text-caption font-bold text-text-secondary mb-2">
          Manager / Staff Feedback
        </label>
        <textarea
          rows={2}
          placeholder="Any comments from venue staff?"
          value={staffFeedback}
          onChange={(e) => setStaffFeedback(e.target.value)}
          className="w-full rounded-xl bg-surface-raised border border-white/[0.06] px-4 py-3 font-body text-body text-text-primary placeholder:text-text-muted resize-none"
        />
      </div>

      {/* Observations */}
      <div className="mb-8">
        <label className="block font-display text-caption font-bold text-text-secondary mb-2">
          Free-Form Observations
        </label>
        <textarea
          rows={3}
          placeholder="Anything else worth noting?"
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          className="w-full rounded-xl bg-surface-raised border border-white/[0.06] px-4 py-3 font-body text-body text-text-primary placeholder:text-text-muted resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-4 rounded-xl bg-accent font-display font-bold text-body text-white transition-[background-color,transform] active:scale-[0.98] disabled:opacity-50 disabled:cursor-wait"
      >
        {submitting ? "Submitting..." : "Submit Debrief"}
      </button>
    </div>
  );
}
