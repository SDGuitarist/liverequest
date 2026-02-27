"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PerformerLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/performer/dashboard");
      } else {
        setError("Wrong password");
      }
    } catch {
      setError("Connection error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="font-display text-title font-bold text-text-primary">
            LiveRequest
          </h1>
          <p className="mt-2 font-body text-caption text-text-secondary">
            Performer Dashboard
          </p>
        </div>

        <div>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-raised text-text-primary font-body text-body placeholder:text-text-muted border border-surface-border focus:border-accent focus:outline-none transition-colors"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-center font-body text-caption text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3 rounded-xl bg-accent font-display font-bold text-surface text-body transition-colors hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
