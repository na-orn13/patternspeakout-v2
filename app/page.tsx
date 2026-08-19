"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Video {
  id: string;
  tiktok_id: string;
  title: string;
  caption: string;
  cover_image_url: string;
  share_url: string;
  duration: number;
  published_at: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  summary: string | null;
  summary_source: "caption" | "transcript" | "manual";
  synced_at: string;
}

interface ApiResponse {
  videos: Video[];
  lastSync: string | null;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 60_000; // re-fetch every 60 s
const CARD_COLORS = [
  "#FF6B6B", "#4ECDC4", "#FFE66D", "#A8E6CF", "#FF8B94",
  "#C3B1E1", "#FFB347", "#85C1E9", "#F0A500", "#82E0AA",
  "#FAD7A0", "#AED6F1",
];
const CARD_EMOJIS = ["🎯","🧊","💪","🫘","💸","🤒","🪨","🐱","🕯️","😬","🎾","🌙",
  "📚","✨","🔥","💡","🌟","🎓","📖","🗣️"];

function colorFor(id: string, i: number) {
  const n = parseInt(id.replace(/\D/g, "").slice(-3) || String(i), 10);
  return CARD_COLORS[n % CARD_COLORS.length];
}
function emojiFor(id: string, i: number) {
  const n = parseInt(id.replace(/\D/g, "").slice(-3) || String(i), 10);
  return CARD_EMOJIS[n % CARD_EMOJIS.length];
}
function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return iso; }
}
function fmtDatetime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("th-TH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-line skeleton-bar skeleton" />
          <div className="skeleton-line title skeleton" />
          <div className="skeleton-line medium skeleton" />
          <div className="skeleton-line long skeleton" />
          <div className="skeleton-line long skeleton" />
          <div className="skeleton-line short skeleton" style={{ marginTop: 24 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "success" | "error" | "" }) {
  return (
    <div className={`toast ${type} ${msg ? "show" : ""}`} role="status" aria-live="polite">
      {type === "success" ? "✅ " : type === "error" ? "❌ " : ""}{msg}
    </div>
  );
}

// ─── Video Card ───────────────────────────────────────────────────────────────
function VideoCard({ video, index, onClick }: { video: Video; index: number; onClick: () => void }) {
  const color = colorFor(video.tiktok_id, index);
  const emoji = emojiFor(video.tiktok_id, index);
  const epNum = String(index + 1).padStart(3, "0");

  return (
    <div
      className="video-card"
      style={{ animationDelay: `${Math.min(index, 5) * 0.06}s` }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={`เปิดรายละเอียด: ${video.title}`}
    >
      <div className="card-accent-line" style={{ background: color }} />

      <div className="card-header">
        {video.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.cover_image_url}
            alt={video.title}
            className="video-thumbnail"
            loading="lazy"
          />
        ) : (
          <div
            className="card-emoji"
            style={{ background: `${color}22`, border: `1px solid ${color}44` }}
          >
            {emoji}
          </div>
        )}

        <div className="card-meta">
          <div className="card-episode">EP.{epNum}</div>
          <div className="card-idiom-title" style={{ fontSize: 15 }}>
            {video.title || video.caption.slice(0, 60)}
          </div>
          <div className="card-tags">
            <span className="tag tag-pos">TikTok</span>
            {video.summary_source === "caption" && (
              <span className="tag" style={{ background: "rgba(255,214,10,0.1)", color: "#ffd60a", border: "1px solid rgba(255,214,10,0.2)", fontSize: 10 }}>
                caption-based
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card-body">
        <div className="card-def-en" style={{ WebkitLineClamp: 3 }}>
          {video.summary
            ? video.summary.slice(0, 160).replace(/\*\*/g, "") + (video.summary.length > 160 ? "…" : "")
            : video.caption.slice(0, 160) + (video.caption.length > 160 ? "…" : "")}
        </div>

        <div className="video-stats">
          <span className="stat-chip">👁 {fmtNum(video.view_count)}</span>
          <span className="stat-chip">❤️ {fmtNum(video.like_count)}</span>
          <span className="stat-chip">💬 {fmtNum(video.comment_count)}</span>
          <span className="stat-chip">↗️ {fmtNum(video.share_count)}</span>
        </div>
      </div>

      <div className="card-footer">
        <div className="card-date">{fmtDate(video.published_at)}</div>
        <div className="card-expand-btn">
          ดูรายละเอียด
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ video, index, onClose }: { video: Video; index: number; onClose: () => void }) {
  const color = colorFor(video.tiktok_id, index);
  const emoji = emojiFor(video.tiktok_id, index);
  const [activeTab, setActiveTab] = useState<"summary" | "caption">("summary");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal">
        <button className="modal-close" onClick={onClose} aria-label="ปิด">✕</button>

        {/* Hero */}
        <div
          className="modal-hero"
          id="modalHero"
          style={{ background: `linear-gradient(135deg, ${color}14 0%, transparent 60%)`, borderBottom: `1px solid ${color}30` }}
        >
          <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: color, opacity: 0.06, pointerEvents: "none" }} />

          <div className="modal-episode-row">
            <span className="modal-episode">EP.{String(index + 1).padStart(3, "0")}</span>
            <span style={{ color: "var(--border)" }}>·</span>
            <span className="modal-date">{fmtDate(video.published_at)}</span>
          </div>

          <div className="modal-emoji-title">
            <div
              className="modal-emoji"
              style={{ background: `${color}22`, border: `1px solid ${color}44` }}
            >
              {emoji}
            </div>
            <div className="modal-title-wrap">
              <div
                id="modal-title"
                className="modal-idiom-name"
                style={{
                  background: `linear-gradient(135deg, #f5f5f5, ${color})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {video.title || "Idiom of the Day"}
              </div>
              <div className="modal-tags">
                <span className="tag tag-pos">TikTok Video</span>
                {video.duration > 0 && (
                  <span className="tag" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)", fontSize: 11 }}>
                    ⏱ {video.duration}s
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="video-stats" style={{ marginTop: 8 }}>
            <span className="stat-chip">👁 {fmtNum(video.view_count)} views</span>
            <span className="stat-chip">❤️ {fmtNum(video.like_count)} likes</span>
            <span className="stat-chip">💬 {fmtNum(video.comment_count)} comments</span>
            <span className="stat-chip">↗️ {fmtNum(video.share_count)} shares</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === "summary" ? "active" : ""}`}
            onClick={() => setActiveTab("summary")}
          >
            📋 Summary
          </button>
          <button
            className={`modal-tab ${activeTab === "caption" ? "active" : ""}`}
            onClick={() => setActiveTab("caption")}
          >
            📝 Caption
          </button>
          <a
            href={video.share_url}
            target="_blank"
            rel="noopener noreferrer"
            className="modal-tab"
            style={{ textDecoration: "none", marginLeft: "auto" }}
          >
            🎵 TikTok ↗
          </a>
        </div>

        {/* Body */}
        <div className="modal-body">

          {/* Summary tab */}
          <div className={`tab-panel ${activeTab === "summary" ? "active" : ""}`}>
            <div className="modal-section">
              <div className="section-label">
                <span className="icon">📋</span>
                AI Summary
              </div>

              <div className="summary-source-badge">
                ⚠️ {video.summary_source === "caption"
                  ? "Caption-based summary — no transcript available from TikTok API"
                  : video.summary_source === "transcript"
                    ? "Transcript-based summary"
                    : "Manually written"}
              </div>

              {video.summary ? (
                <div className="summary-box">{video.summary}</div>
              ) : (
                <div className="summary-box" style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                  Summary not yet generated. Click "Sync Now" in the admin bar to generate summaries.
                </div>
              )}
            </div>

            <div className="modal-section" style={{ marginTop: 24 }}>
              <div className="section-label">
                <span className="icon">📊</span>
                Video Stats
              </div>
              <div className="usage-row">
                <div className="usage-badge">
                  <span><strong>Published</strong>{fmtDate(video.published_at)}</span>
                </div>
                <div className="context-badge">
                  <span><strong>Last synced</strong>{fmtDate(video.synced_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Caption tab */}
          <div className={`tab-panel ${activeTab === "caption" ? "active" : ""}`}>
            <div className="modal-section">
              <div className="section-label">
                <span className="icon">📝</span>
                Original Caption
              </div>
              <div className="def-box en">
                <div className="def-text" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
                  {video.caption || "(No caption available)"}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [filtered, setFiltered] = useState<Video[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimit, setIsRateLimit] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [selectedVideo, setSelectedVideo] = useState<{ video: Video; index: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "" }>({ msg: "", type: "" });
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [showSecretInput, setShowSecretInput] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  };

  // ── Fetch videos ──────────────────────────────────────────────────────────
  const fetchVideos = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    setIsRateLimit(false);

    try {
      const res = await fetch("/api/videos", { cache: "no-store" });

      if (res.status === 429) {
        setIsRateLimit(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data: ApiResponse = await res.json();
      setVideos(data.videos);
      setLastSync(data.lastSync);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchVideos();
    pollTimer.current = setInterval(() => fetchVideos(true), POLL_INTERVAL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [fetchVideos]);

  // ── Filter & sort ─────────────────────────────────────────────────────────
  useEffect(() => {
    let result = [...videos];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.caption.toLowerCase().includes(q) ||
          (v.summary ?? "").toLowerCase().includes(q)
      );
    }
    switch (sort) {
      case "newest":
        result.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime());
        break;
      case "views":
        result.sort((a, b) => b.view_count - a.view_count);
        break;
      case "likes":
        result.sort((a, b) => b.like_count - a.like_count);
        break;
    }
    setFiltered(result);
  }, [videos, search, sort]);

  // ── Admin sync ────────────────────────────────────────────────────────────
  const handleSync = async () => {
    const secret = adminSecret.trim();
    if (!secret) {
      setShowSecretInput(true);
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      });
      const body = await res.json();
      if (res.status === 401) {
        showToast("Incorrect admin secret", "error");
        return;
      }
      if (res.status === 429) {
        showToast("Rate limited — try again later", "error");
        return;
      }
      if (!res.ok) {
        showToast(`Sync failed: ${body.detail ?? body.error}`, "error");
        return;
      }
      showToast(
        `Sync complete — ${body.newVideos} new video${body.newVideos !== 1 ? "s" : ""} added`,
        "success"
      );
      await fetchVideos(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Sync error", "error");
    } finally {
      setSyncing(false);
    }
  };

  // Admin toggle: triple-click the "last updated" area
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAdminToggle = () => {
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 600);
    if (clickCount.current >= 3) {
      setShowAdmin((v) => !v);
      clickCount.current = 0;
    }
  };

  // ── Particles (client-only) ───────────────────────────────────────────────
  const particlesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = particlesRef.current;
    if (!container) return;
    for (let i = 0; i < 20; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      p.style.cssText = `
        left:${Math.random() * 100}%;
        animation-duration:${6 + Math.random() * 10}s;
        animation-delay:${Math.random() * 8}s;
        width:${1 + Math.random() * 3}px;
        height:${1 + Math.random() * 3}px;
        background:${Math.random() > 0.5 ? "#ff2d55" : "#ffd60a"};
      `;
      container.appendChild(p);
    }
  }, []);

  // ── Back to top ───────────────────────────────────────────────────────────
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* HERO */}
      <header className="hero">
        <div className="particles" ref={particlesRef} aria-hidden="true" />

        <div className="channel-badge">
          <span className="tiktok-logo">tt</span>
          @patternspeakout &nbsp;·&nbsp; Idiom of the Day
        </div>

        <h1>
          <span className="gradient-text">Idiom of the Day</span>
          <br />Vlog Summary
        </h1>

        <p className="subtitle">
          สรุปทุก Episode จาก TikTok{" "}
          <strong>@patternspeakout</strong> — เรียนรู้ Idiom ภาษาอังกฤษพร้อม
          AI Summary, ความหมายไทย–อังกฤษ และตัวอย่างประโยค
        </p>

        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-number">{loading ? "…" : videos.length}</div>
            <div className="stat-label">Episodes</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">🤖</div>
            <div className="stat-label">AI Summary</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">🇹🇭 🇬🇧</div>
            <div className="stat-label">Bilingual</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">🔴</div>
            <div className="stat-label">Live Data</div>
          </div>
        </div>
      </header>

      {/* STATUS BAR */}
      <div className="status-bar">
        <div className="status-bar-inner">
          <div className="last-updated" onClick={handleAdminToggle} style={{ cursor: "default" }}>
            <span className="live-dot" />
            <span>อัปเดตล่าสุด: {fmtDatetime(lastSync)}</span>
          </div>

          {/* Admin section — revealed by triple-click */}
          {showAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {showSecretInput && (
                <input
                  type="password"
                  placeholder="Admin secret…"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSync()}
                  style={{
                    padding: "6px 12px", borderRadius: 100, border: "1px solid var(--border)",
                    background: "var(--bg-card)", color: "var(--text-primary)",
                    fontFamily: "var(--font-main)", fontSize: 13, outline: "none", width: 180,
                  }}
                  autoFocus
                />
              )}
              <button
                className="sync-btn"
                onClick={handleSync}
                disabled={syncing}
                aria-label="Sync videos now"
              >
                {syncing ? <span className="spin">↻</span> : "↻"}
                {syncing ? " Syncing…" : " Sync Now"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CONTROLS */}
      <nav className="controls-bar" aria-label="Filter and search controls">
        <div className="controls-inner">
          <div className="search-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา Idiom, Summary, Caption…"
              aria-label="ค้นหา"
              autoComplete="off"
              id="searchInput"
            />
          </div>

          <select
            className="sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="เรียงลำดับ"
          >
            <option value="newest">ใหม่สุด ↓</option>
            <option value="oldest">เก่าสุด ↑</option>
            <option value="views">ยอดวิวสูงสุด</option>
            <option value="likes">ยอดไลค์สูงสุด</option>
          </select>
        </div>
      </nav>

      {/* MAIN */}
      <main className="main-content">
        <div className="section-header">
          <h2 className="section-title">
            <span className="dot" aria-hidden="true" />
            All Episodes
          </h2>
          <div className="result-count" aria-live="polite">
            {loading ? "กำลังโหลด…" : `${filtered.length} video${filtered.length !== 1 ? "s" : ""}`}
          </div>
        </div>

        <div className="idiom-grid" role="list">
          {/* Loading */}
          {loading && <SkeletonGrid />}

          {/* Rate limit */}
          {!loading && isRateLimit && (
            <div className="rate-limit-banner">
              <span style={{ fontSize: 20 }}>⏳</span>
              <div>
                <strong>Rate limited</strong> — Too many requests. Please wait a moment and try again.
                <br />
                <button className="retry-btn" style={{ marginTop: 8 }} onClick={() => fetchVideos()}>
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && !isRateLimit && error && (
            <div className="error-state">
              <span style={{ fontSize: 48 }}>⚠️</span>
              <h3>ไม่สามารถโหลดข้อมูลได้</h3>
              <p>{error}</p>
              <button className="retry-btn" onClick={() => fetchVideos()}>
                ลองอีกครั้ง
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && !isRateLimit && filtered.length === 0 && (
            <div className="no-results">
              <span className="no-results-emoji">
                {search ? "🔍" : "📭"}
              </span>
              <h3>
                {search
                  ? "ไม่พบ Idiom ที่ค้นหา"
                  : "ยังไม่มีวิดีโอ — กด Sync Now เพื่อโหลดข้อมูล"}
              </h3>
              <p>
                {search
                  ? "ลองค้นหาด้วยคำอื่น"
                  : "Triple-click the 'Last updated' bar above to reveal the admin panel"}
              </p>
            </div>
          )}

          {/* Cards */}
          {!loading && !error && !isRateLimit &&
            filtered.map((video, i) => (
              <VideoCard
                key={video.id}
                video={video}
                index={i}
                onClick={() => setSelectedVideo({ video, index: i })}
              />
            ))}
        </div>
      </main>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-logo">Pattern Speak Out</div>
          <p>
            เว็บไซต์นี้เป็น Vlog Summary สรุปเนื้อหาจาก TikTok{" "}
            <a href="https://www.tiktok.com/@patternspeakout" target="_blank" rel="noopener noreferrer">
              @patternspeakout
            </a>
            <br />
            Summaries generated by OpenAI GPT-3.5 · Based on video captions · No transcript data from TikTok API
          </p>
          <a
            className="footer-tiktok-link"
            href="https://www.tiktok.com/@patternspeakout"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ดูช่อง @patternspeakout บน TikTok"
          >
            <span className="tiktok-logo" aria-hidden="true">tt</span>
            ดูช่องต้นฉบับบน TikTok
          </a>
        </div>
      </footer>

      {/* BACK TO TOP */}
      <button
        id="backToTop"
        className={showTop ? "visible" : ""}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="กลับขึ้นด้านบน"
      >
        ↑
      </button>

      {/* MODAL */}
      {selectedVideo && (
        <Modal
          video={selectedVideo.video}
          index={selectedVideo.index}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      {/* TOAST */}
      <Toast msg={toast.msg} type={toast.type} />
    </>
  );
}
