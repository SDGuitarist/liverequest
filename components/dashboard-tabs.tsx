"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Tab = "requests" | "setlist";

interface DashboardTabsProps {
  sessionId: string;
  requestsContent: ReactNode;
  setlistContent: ReactNode;
}

export function DashboardTabs({ sessionId, requestsContent, setlistContent }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("requests");
  const [endingSet, setEndingSet] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const handleEndSetStart = useCallback(() => {
    holdTimerRef.current = setTimeout(async () => {
      setEndingSet(true);
      try {
        const res = await fetch("/api/session/end-set", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        if (res.ok) {
          router.refresh();
        } else {
          setEndingSet(false);
        }
      } catch {
        setEndingSet(false);
      }
    }, 1500);
  }, [sessionId, router]);

  const handleEndSetCancel = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  return (
    <div className="min-h-screen">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 flex items-center gap-1 px-5 py-3 bg-surface/80 backdrop-blur-sm border-b border-white/[0.06]">
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex-1 py-2 rounded-lg font-display font-bold text-caption transition-colors ${
            activeTab === "requests"
              ? "bg-accent/15 text-accent border border-accent/20"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Requests
        </button>
        <button
          onClick={() => setActiveTab("setlist")}
          className={`flex-1 py-2 rounded-lg font-display font-bold text-caption transition-colors ${
            activeTab === "setlist"
              ? "bg-accent/15 text-accent border border-accent/20"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Setlist
        </button>
        {/* End Set — hold to confirm */}
        <button
          onMouseDown={handleEndSetStart}
          onMouseUp={handleEndSetCancel}
          onMouseLeave={handleEndSetCancel}
          onTouchStart={handleEndSetStart}
          onTouchEnd={handleEndSetCancel}
          disabled={endingSet}
          className="ml-2 px-3 py-2 rounded-lg font-display font-bold text-caption text-text-muted hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-wait"
          title="Hold 1.5s to end set"
        >
          {endingSet ? "Ending..." : "End Set"}
        </button>
      </div>

      {/* Both children always mounted — CSS hidden only */}
      <div className={activeTab !== "requests" ? "hidden" : undefined}>
        {requestsContent}
      </div>
      <div className={activeTab !== "setlist" ? "hidden" : undefined}>
        {setlistContent}
      </div>
    </div>
  );
}
