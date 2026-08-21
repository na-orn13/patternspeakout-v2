"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface StatsData {
  pageViews: { today: number; thisWeek: number; total: number };
  activeUsersThisWeek: number;
  totalEvents: number;
  topEpisodes: Array<{ id: string; title: string; clicks: number }>;
  topFavourites: Array<{ id: string; name: string; saves: number }>;
}

export default function StatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const adminToken = sessionStorage.getItem("deck_userId");
    if (!adminToken || adminToken !== "admin") {
      setError("Admin access required. Please sign in as admin from the main page.");
      setLoading(false);
      return;
    }

    // Fetch stats from the API
    fetch("/api/analytics", {
      headers: { Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setStats(d);
      })
      .catch(() => setError("Failed to load stats."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="deck-page">
      <div className="deck-header">
        <button className="deck-back" onClick={() => router.back()}>← Back</button>
        <h1 className="deck-title">📊 Analytics Dashboard</h1>
      </div>

      <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
        {loading && <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>Loading stats…</p>}

        {error && (
          <div className="error-state" style={{ margin: 40 }}>
            <span style={{ fontSize: 48 }}>🔒</span>
            <h3>{error}</h3>
            <button className="retry-btn" onClick={() => router.push("/")}>← Go to main page</button>
          </div>
        )}

        {stats && (
          <>
            {/* Page views */}
            <div className="admin-card" style={{ marginBottom: 16 }}>
              <div className="admin-section-label">👁 Page Views</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, textAlign: "center", marginTop: 12 }}>
                <div className="stats-box"><div className="stats-num">{stats.pageViews.today}</div><div className="stats-label">Today</div></div>
                <div className="stats-box"><div className="stats-num">{stats.pageViews.thisWeek}</div><div className="stats-label">This Week</div></div>
                <div className="stats-box"><div className="stats-num">{stats.pageViews.total}</div><div className="stats-label">All Time</div></div>
              </div>
            </div>

            {/* Summary */}
            <div className="admin-card" style={{ marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "center" }}>
                <div className="stats-box"><div className="stats-num">{stats.activeUsersThisWeek}</div><div className="stats-label">Active Users (Week)</div></div>
                <div className="stats-box"><div className="stats-num">{stats.totalEvents}</div><div className="stats-label">Total Events</div></div>
              </div>
            </div>

            {/* Top Episodes */}
            {stats.topEpisodes.length > 0 && (
              <div className="admin-card" style={{ marginBottom: 16 }}>
                <div className="admin-section-label">🔥 Most Opened Episodes (30 days)</div>
                <div className="admin-episode-list" style={{ maxHeight: 300, marginTop: 12 }}>
                  {stats.topEpisodes.map((ep, i) => (
                    <div key={ep.id} className="admin-ep-row">
                      <div className="admin-ep-info">
                        <span className="admin-ep-emoji" style={{ fontSize: 14, width: 24 }}>{i + 1}.</span>
                        <div><div className="admin-ep-name">{ep.title}</div></div>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--slate)", fontFamily: "var(--font-mono)" }}>{ep.clicks} clicks</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Favourites */}
            {stats.topFavourites.length > 0 && (
              <div className="admin-card" style={{ marginBottom: 16 }}>
                <div className="admin-section-label">❤️ Most Saved (30 days)</div>
                <div className="admin-episode-list" style={{ maxHeight: 300, marginTop: 12 }}>
                  {stats.topFavourites.map((f, i) => (
                    <div key={f.id} className="admin-ep-row">
                      <div className="admin-ep-info">
                        <span className="admin-ep-emoji" style={{ fontSize: 14, width: 24 }}>{i + 1}.</span>
                        <div><div className="admin-ep-name">{f.name}</div></div>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--coral)", fontFamily: "var(--font-mono)" }}>{f.saves} saves</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.topEpisodes.length === 0 && stats.topFavourites.length === 0 && (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <p style={{ color: "var(--text-muted)" }}>No interaction data yet. Stats will appear as users browse the site.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
