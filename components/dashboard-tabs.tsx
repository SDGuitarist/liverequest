"use client";

import { useState, type ReactNode } from "react";

type Tab = "requests" | "setlist";

interface DashboardTabsProps {
  requestsContent: ReactNode;
  setlistContent: ReactNode;
}

export function DashboardTabs({ requestsContent, setlistContent }: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("requests");

  return (
    <div className="min-h-screen">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 flex gap-1 px-5 py-3 bg-surface/80 backdrop-blur-sm border-b border-white/[0.06]">
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
