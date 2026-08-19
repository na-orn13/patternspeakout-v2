"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface KeyWord {
  word: string;
  cefr: string;
  pos: string;
  definitionEN: string;
  definitionTH: string;
  synonyms: string[];
  antonyms: string[];
}

interface Example {
  en: string;
  th: string;
}

interface IdiomData {
  idiom: string;
  cefr: string;
  partOfSpeech: string;
  episode?: string;
  date?: string;
  thumbnail?: string;
  color?: string;
  tiktokUrl?: string;
  definitionEN: string;
  definitionTH: string;
  synonyms: string[];
  antonyms: string[];
  keyWords: KeyWord[];
  examples: Example[];
  usage: string;
  context: string;
}

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
  summary_source: "caption" | "transcript" | "manual" | "structured";
  synced_at: string;
}

interface ApiResponse {
  videos: Video[];
  lastSync: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 60_000;
const CARD_COLORS = ["#FF6B6B","#4ECDC4","#FFE66D","#A8E6CF","#FF8B94","#C3B1E1","#FFB347","#85C1E9","#F0A500","#82E0AA","#FAD7A0","#AED6F1"];
const CARD_EMOJIS = ["🎯","🧊","💪","🫘","💸","🤒","🪨","🐱","🕯️","😬","🎾","🌙","📚","✨","🔥","💡","🌟","🎓","📖","🗣️"];

function getIdiomData(video: Video): IdiomData | null {
  if (video.summary) {
    try {
      const parsed = JSON.parse(video.summary);
      if (parsed && typeof parsed === "object" && parsed.idiom && parsed.definitionEN) {
        return parsed as IdiomData;
      }
    } catch { /* not JSON — that's fine */ }
  }
  return null;
}

function colorFor(video: Video, i: number) {
  const data = getIdiomData(video);
  if (data?.color) return data.color;
  const n = parseInt(video.tiktok_id.replace(/\D/g, "").slice(-3) || String(i), 10);
  return CARD_COLORS[n % CARD_COLORS.length];
}

function emojiFor(video: Video, i: number) {
  const data = getIdiomData(video);
  if (data?.thumbnail) return data.thumbnail;
  const n = parseInt(video.tiktok_id.replace(/\D/g, "").slice(-3) || String(i), 10);
  return CARD_EMOJIS[n % CARD_EMOJIS.length];
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
}

function fmtDatetime(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
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
          <div className="skeleton-line short skeleton" style={{ marginTop: 24 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "success" | "error" | "" }) {
  return <div className={`toast ${type} ${msg ? "show" : ""}`} role="status" aria-live="polite">{type === "success" ? "✅ " : type === "error" ? "❌ " : ""}{msg}</div>;
}

// ─── Video Card ───────────────────────────────────────────────────────────────
function VideoCard({ video, index, onClick, isAdmin, onEdit, onDelete }: {
  video: Video; index: number; onClick: () => void;
  isAdmin?: boolean; onEdit?: () => void; onDelete?: () => void;
}) {
  const color = colorFor(video, index);
  const emoji = emojiFor(video, index);
  const data = getIdiomData(video);
  const epNum = data?.episode ?? `EP.${String(index + 1).padStart(3, "0")}`;

  return (
    <div className="idiom-card" style={{ animationDelay: `${Math.min(index, 5) * 0.06}s` }}>
      <div className="card-accent-line" style={{ background: color }} />

      {/* Admin overlay buttons */}
      {isAdmin && (
        <div className="card-admin-btns">
          <button className="card-admin-btn edit" onClick={(e) => { e.stopPropagation(); onEdit?.(); }} title="Edit">✏️</button>
          <button className="card-admin-btn delete" onClick={(e) => { e.stopPropagation(); onDelete?.(); }} title="Delete">🗑️</button>
        </div>
      )}

      <div className="card-clickable" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onClick()}
        aria-label={`เปิดรายละเอียด: ${data?.idiom ?? video.title}`}>
        <div className="card-header">
          <div className="card-emoji" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>{emoji}</div>
          <div className="card-meta">
            <div className="card-episode">{epNum}</div>
            <div className="card-idiom-title">{data?.idiom ?? video.title}</div>
            <div className="card-tags">
              {data?.cefr && <span className={`tag tag-cefr ${data.cefr}`}>{data.cefr}</span>}
              {data?.partOfSpeech && <span className="tag tag-pos">{data.partOfSpeech}</span>}
              {!data && <span className="tag tag-pos">TikTok</span>}
            </div>
          </div>
        </div>
        <div className="card-body">
          {data ? (
            <>
              <div className="card-flag">🇬🇧 English</div>
              <div className="card-def-en">{data.definitionEN}</div>
              <div className="card-flag" style={{ marginTop: 10 }}>🇹🇭 ภาษาไทย</div>
              <div className="card-def-th">{data.definitionTH}</div>
            </>
          ) : (
            <div className="card-def-en">{video.caption.slice(0, 160)}{video.caption.length > 160 ? "…" : ""}</div>
          )}
        </div>
        <div className="card-footer">
          <div className="card-date">{fmtDate(video.published_at)}</div>
          <div className="card-expand-btn">
            ดูรายละเอียด
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal (Low-code friendly form) ──────────────────────────────────────
function EditModal({ video, token, onClose, onSaved, onToast }: {
  video: Video; token: string; onClose: () => void; onSaved: () => void; onToast: (m: string, t: "success"|"error") => void;
}) {
  const data = getIdiomData(video);
  const [idiom, setIdiom] = useState(data?.idiom ?? "");
  const [cefr, setCefr] = useState(data?.cefr ?? "B1");
  const [partOfSpeech, setPartOfSpeech] = useState(data?.partOfSpeech ?? "verb phrase");
  const [episode, setEpisode] = useState(data?.episode ?? "");
  const [date, setDate] = useState(data?.date ?? "");
  const [thumbnail, setThumbnail] = useState(data?.thumbnail ?? "");
  const [color, setColor] = useState(data?.color ?? "#FF6B6B");
  const [defEN, setDefEN] = useState(data?.definitionEN ?? "");
  const [defTH, setDefTH] = useState(data?.definitionTH ?? "");
  const [synonyms, setSynonyms] = useState((data?.synonyms ?? []).join(", "));
  const [antonyms, setAntonyms] = useState((data?.antonyms ?? []).join(", "));
  const [usage, setUsage] = useState(data?.usage ?? "");
  const [context, setContext] = useState(data?.context ?? "");
  const [examples, setExamples] = useState<Array<{en: string; th: string}>>(data?.examples ?? [{ en: "", th: "" }]);
  const [keyWords, setKeyWords] = useState<Array<{word:string;cefr:string;pos:string;definitionEN:string;definitionTH:string;synonyms:string;antonyms:string}>>(
    (data?.keyWords ?? []).map(kw => ({ ...kw, synonyms: kw.synonyms.join(", "), antonyms: kw.antonyms.join(", ") }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);

  const handleSave = async () => {
    if (!idiom.trim() || !defEN.trim()) { onToast("Idiom name and English definition are required.", "error"); return; }
    setSaving(true);
    const body = {
      tiktokId: video.tiktok_id,
      data: {
        idiom: idiom.trim(),
        cefr, partOfSpeech,
        episode: episode.trim() || undefined,
        date: date.trim() || undefined,
        thumbnail: thumbnail.trim() || undefined,
        color: color.trim() || undefined,
        definitionEN: defEN.trim(),
        definitionTH: defTH.trim(),
        synonyms: synonyms.split(",").map(s => s.trim()).filter(Boolean),
        antonyms: antonyms.split(",").map(s => s.trim()).filter(Boolean),
        keyWords: keyWords.map(kw => ({
          word: kw.word, cefr: kw.cefr, pos: kw.pos,
          definitionEN: kw.definitionEN, definitionTH: kw.definitionTH,
          synonyms: kw.synonyms.split(",").map(s => s.trim()).filter(Boolean),
          antonyms: kw.antonyms.split(",").map(s => s.trim()).filter(Boolean),
        })),
        examples: examples.filter(ex => ex.en.trim()),
        usage: usage.trim(), context: context.trim(),
      },
    };
    try {
      const res = await fetch("/api/idioms/edit", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      if (!res.ok) { onToast(`Save failed: ${result.error}`, "error"); return; }
      onToast(`✅ "${idiom}" saved!`, "success");
      onSaved(); onClose();
    } catch { onToast("Network error.", "error"); }
    finally { setSaving(false); }
  };

  const addExample = () => setExamples([...examples, { en: "", th: "" }]);
  const removeExample = (i: number) => setExamples(examples.filter((_, j) => j !== i));
  const updateExample = (i: number, field: "en"|"th", val: string) => { const copy = [...examples]; copy[i] = { ...copy[i], [field]: val }; setExamples(copy); };

  const addKeyWord = () => setKeyWords([...keyWords, { word: "", cefr: "A1", pos: "noun", definitionEN: "", definitionTH: "", synonyms: "", antonyms: "" }]);
  const removeKeyWord = (i: number) => setKeyWords(keyWords.filter((_, j) => j !== i));
  const updateKeyWord = (i: number, field: string, val: string) => { const copy = [...keyWords]; copy[i] = { ...copy[i], [field]: val }; setKeyWords(copy); };

  return (
    <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 680 }}>
        <button className="modal-close" onClick={onClose} aria-label="ปิด">✕</button>
        <div className="modal-hero" style={{ padding: "24px 32px", background: "var(--bg-card2)" }}>
          <div className="modal-idiom-name" style={{ fontSize: 20 }}>✏️ Edit: {idiom || "New Idiom"}</div>
        </div>
        <div className="modal-body" style={{ padding: "24px 32px", gap: 20, maxHeight: "70vh", overflowY: "auto" }}>

          {/* Basic info */}
          <div className="edit-row">
            <div className="edit-field" style={{ flex: 2 }}>
              <label className="edit-label">Idiom Name *</label>
              <input className="edit-input" value={idiom} onChange={e => setIdiom(e.target.value)} placeholder="Hit the nail on the head" />
            </div>
            <div className="edit-field">
              <label className="edit-label">CEFR</label>
              <select className="edit-input" value={cefr} onChange={e => setCefr(e.target.value)}>
                <option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option>
              </select>
            </div>
          </div>

          <div className="edit-row">
            <div className="edit-field">
              <label className="edit-label">Part of Speech</label>
              <input className="edit-input" value={partOfSpeech} onChange={e => setPartOfSpeech(e.target.value)} placeholder="verb phrase" />
            </div>
            <div className="edit-field">
              <label className="edit-label">Episode</label>
              <input className="edit-input" value={episode} onChange={e => setEpisode(e.target.value)} placeholder="EP.001" />
            </div>
            <div className="edit-field">
              <label className="edit-label">Date</label>
              <input className="edit-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div className="edit-row">
            <div className="edit-field">
              <label className="edit-label">Emoji</label>
              <input className="edit-input" value={thumbnail} onChange={e => setThumbnail(e.target.value)} placeholder="🎯" style={{ fontSize: 20, textAlign: "center" }} />
            </div>
            <div className="edit-field">
              <label className="edit-label">Color</label>
              <input className="edit-input" type="color" value={color} onChange={e => setColor(e.target.value)} style={{ height: 38, padding: 2 }} />
            </div>
            <div className="edit-field" style={{ flex: 2 }}>
              <label className="edit-label">Usage</label>
              <input className="edit-input" value={usage} onChange={e => setUsage(e.target.value)} placeholder="Formal & Informal" />
            </div>
          </div>

          {/* Definitions */}
          <div className="edit-field">
            <label className="edit-label">🇬🇧 Definition (English) *</label>
            <textarea className="edit-input" rows={2} value={defEN} onChange={e => setDefEN(e.target.value)} placeholder="To be precisely correct about something." />
          </div>
          <div className="edit-field">
            <label className="edit-label">🇹🇭 ความหมาย (ไทย)</label>
            <textarea className="edit-input" rows={2} value={defTH} onChange={e => setDefTH(e.target.value)} placeholder="พูดถูกต้องแม่นยำ / ตรงประเด็น" />
          </div>

          {/* Synonyms / Antonyms / Context */}
          <div className="edit-field">
            <label className="edit-label">Synonyms (comma-separated)</label>
            <input className="edit-input" value={synonyms} onChange={e => setSynonyms(e.target.value)} placeholder="be spot on, be exactly right, be dead right" />
          </div>
          <div className="edit-field">
            <label className="edit-label">Antonyms (comma-separated)</label>
            <input className="edit-input" value={antonyms} onChange={e => setAntonyms(e.target.value)} placeholder="miss the point, be off the mark" />
          </div>
          <div className="edit-field">
            <label className="edit-label">Context</label>
            <input className="edit-input" value={context} onChange={e => setContext(e.target.value)} placeholder="Work, discussion, debate" />
          </div>

          {/* Examples */}
          <div>
            <div className="edit-label" style={{ marginBottom: 8 }}>✍️ Example Sentences</div>
            {examples.map((ex, i) => (
              <div key={i} className="edit-example-row">
                <div className="edit-example-num">{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <input className="edit-input" value={ex.en} onChange={e => updateExample(i, "en", e.target.value)} placeholder="English sentence…" style={{ marginBottom: 4 }} />
                  <input className="edit-input" value={ex.th} onChange={e => updateExample(i, "th", e.target.value)} placeholder="คำแปลภาษาไทย…" />
                </div>
                <button className="edit-remove-btn" onClick={() => removeExample(i)} title="Remove">✕</button>
              </div>
            ))}
            <button className="edit-add-btn" onClick={addExample}>+ Add example</button>
          </div>

          {/* Key Words */}
          <div>
            <div className="edit-label" style={{ marginBottom: 8 }}>🔑 Key Words</div>
            {keyWords.map((kw, i) => (
              <div key={i} className="edit-keyword-block">
                <div className="edit-row">
                  <div className="edit-field"><input className="edit-input" value={kw.word} onChange={e => updateKeyWord(i, "word", e.target.value)} placeholder="Word" /></div>
                  <div className="edit-field">
                    <select className="edit-input" value={kw.cefr} onChange={e => updateKeyWord(i, "cefr", e.target.value)}>
                      <option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option>
                    </select>
                  </div>
                  <div className="edit-field"><input className="edit-input" value={kw.pos} onChange={e => updateKeyWord(i, "pos", e.target.value)} placeholder="noun" /></div>
                  <button className="edit-remove-btn" onClick={() => removeKeyWord(i)} title="Remove">✕</button>
                </div>
                <input className="edit-input" value={kw.definitionEN} onChange={e => updateKeyWord(i, "definitionEN", e.target.value)} placeholder="🇬🇧 Definition" style={{ marginBottom: 4 }} />
                <input className="edit-input" value={kw.definitionTH} onChange={e => updateKeyWord(i, "definitionTH", e.target.value)} placeholder="🇹🇭 ความหมาย" style={{ marginBottom: 4 }} />
                <input className="edit-input" value={kw.synonyms} onChange={e => updateKeyWord(i, "synonyms", e.target.value)} placeholder="Synonyms (comma)" style={{ marginBottom: 4 }} />
                <input className="edit-input" value={kw.antonyms} onChange={e => updateKeyWord(i, "antonyms", e.target.value)} placeholder="Antonyms (comma)" />
              </div>
            ))}
            <button className="edit-add-btn" onClick={addKeyWord}>+ Add key word</button>
          </div>

          {/* Save */}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="admin-login-btn" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spin">↻</span> Saving…</> : <>💾 Save Changes</>}
            </button>
            <button className="admin-action-btn" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }} onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rich Detail Modal ────────────────────────────────────────────────────────
function DetailModal({ video, index, onClose }: { video: Video; index: number; onClose: () => void }) {
  const color = colorFor(video, index);
  const emoji = emojiFor(video, index);
  const data = getIdiomData(video);

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);

  return (
    <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="modal">
        <button className="modal-close" onClick={onClose} aria-label="ปิด">✕</button>

        {/* Hero */}
        <div className="modal-hero" style={{ background: `linear-gradient(135deg, ${color}14 0%, transparent 60%)`, borderBottom: `1px solid ${color}30` }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: color, opacity: 0.06, pointerEvents: "none" }} />
          <div className="modal-episode-row">
            <span className="modal-episode">{data?.episode ?? `EP.${String(index + 1).padStart(3, "0")}`}</span>
            <span style={{ color: "var(--border)" }}>·</span>
            <span className="modal-date">{fmtDate(video.published_at)}</span>
          </div>
          <div className="modal-emoji-title">
            <div className="modal-emoji" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>{emoji}</div>
            <div className="modal-title-wrap">
              <div className="modal-idiom-name" style={{ background: `linear-gradient(135deg, #f5f5f5, ${color})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                {data?.idiom ?? video.title}
              </div>
              <div className="modal-tags">
                {data?.cefr && <span className={`tag tag-cefr ${data.cefr}`}>{data.cefr}</span>}
                {data?.partOfSpeech && <span className="tag tag-pos">{data.partOfSpeech}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body">
          {data ? (
            <>
              {/* Definition */}
              <div className="modal-section">
                <div className="section-label"><span className="icon">📖</span>ความหมาย · Definition</div>
                <div className="def-box en"><div className="def-lang">🇬🇧 English</div><div className="def-text">{data.definitionEN}</div></div>
                <div className="def-box th"><div className="def-lang">🇹🇭 ภาษาไทย</div><div className="def-text">{data.definitionTH}</div></div>
              </div>

              {/* Synonyms & Antonyms */}
              <div className="modal-section">
                <div className="section-label"><span className="icon">🔄</span>Synonyms &amp; Antonyms</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10, fontWeight: 600 }}>✅ Synonyms (คำพ้องความหมาย)</div>
                  <div className="word-chips">{data.synonyms.map((s, i) => <span key={i} className="chip chip-syn">{s}</span>)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10, fontWeight: 600 }}>❌ Antonyms (คำตรงข้าม)</div>
                  <div className="word-chips">{data.antonyms.map((a, i) => <span key={i} className="chip chip-ant">{a}</span>)}</div>
                </div>
              </div>

              {/* Usage & Context */}
              <div className="modal-section">
                <div className="section-label"><span className="icon">💬</span>การใช้งาน · Usage</div>
                <div className="usage-row">
                  <div className="usage-badge"><span><strong>Register</strong>{data.usage}</span></div>
                  <div className="context-badge"><span><strong>Context</strong>{data.context}</span></div>
                </div>
              </div>

              {/* Key Words */}
              {data.keyWords.length > 0 && (
                <div className="modal-section">
                  <div className="section-label"><span className="icon">🔑</span>Key Words — CEFR Breakdown</div>
                  <div className="keywords-grid">
                    {data.keyWords.map((kw, i) => (
                      <div key={i} className="keyword-card">
                        <div className="keyword-header">
                          <div className="keyword-word">{kw.word}</div>
                          <div className="keyword-badges">
                            <span className={`tag tag-cefr ${kw.cefr}`}>{kw.cefr}</span>
                            <span className="tag tag-pos">{kw.pos}</span>
                          </div>
                        </div>
                        <div className="keyword-def-en">🇬🇧 {kw.definitionEN}</div>
                        <div className="keyword-def-th">🇹🇭 {kw.definitionTH}</div>
                        {kw.synonyms.length > 0 && (
                          <div className="keyword-syn-row">
                            <div className="keyword-syn-label">Synonyms</div>
                            <div className="mini-chips">{kw.synonyms.map((s, j) => <span key={j} className="mini-chip mini-chip-syn">{s}</span>)}</div>
                          </div>
                        )}
                        {kw.antonyms.length > 0 && (
                          <div className="keyword-ant-row">
                            <div className="keyword-ant-label">Antonyms</div>
                            <div className="mini-chips">{kw.antonyms.map((a, j) => <span key={j} className="mini-chip mini-chip-ant">{a}</span>)}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Examples */}
              {data.examples.length > 0 && (
                <div className="modal-section">
                  <div className="section-label"><span className="icon">✍️</span>ตัวอย่างประโยค · Example Sentences</div>
                  <div className="example-list">
                    {data.examples.map((ex, i) => {
                      const escaped = data.idiom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                      const regex = new RegExp(`(${escaped})`, "gi");
                      const highlighted = ex.en.replace(regex, `<span class="highlight-idiom">$1</span>`);
                      return (
                        <div key={i} className="example-item">
                          <div className="example-num">{i + 1}</div>
                          <div className="example-en" dangerouslySetInnerHTML={{ __html: `"${highlighted}"` }} />
                          <div className="example-th">{ex.th}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TikTok link */}
              {video.share_url && video.share_url !== "https://www.tiktok.com/@patternspeakout" && (
                <div className="modal-section">
                  <a href={video.share_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.3)", borderRadius: 100, color: "var(--accent2)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                    🎵 ดูวิดีโอต้นฉบับบน TikTok
                  </a>
                </div>
              )}
            </>
          ) : (
            /* Fallback for non-structured entries */
            <div className="modal-section">
              <div className="section-label"><span className="icon">📝</span>Caption</div>
              <div className="def-box en"><div className="def-text" style={{ whiteSpace: "pre-wrap" }}>{video.caption}</div></div>
              {video.share_url && (
                <a href={video.share_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, padding: "10px 18px", background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.3)", borderRadius: 100, color: "var(--accent2)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                  🎵 ดูวิดีโอบน TikTok
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
interface AdminPanelProps { open: boolean; onClose: () => void; onToast: (msg: string, type: "success" | "error") => void; onRefresh: () => void; onAuth: (token: string) => void; }

function AdminPanel({ open, onClose, onToast, onRefresh, onAuth }: AdminPanelProps) {
  const [authed, setAuthed] = useState(false);
  const [token, setToken] = useState("");
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [episodes, setEpisodes] = useState<Array<{ tiktok_id: string; title: string; idiomData: IdiomData | null }>>([]);
  const [editingEp, setEditingEp] = useState<{ tiktok_id: string; title: string; idiomData: IdiomData | null } | null>(null);
  const [editJson, setEditJson] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editResult, setEditResult] = useState<string | null>(null);

  // Fetch episodes when panel opens and user is authed
  const fetchEpisodes = useCallback(async () => {
    try {
      const res = await fetch("/api/videos", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const eps = (data.videos ?? []).map((v: Video) => ({
        tiktok_id: v.tiktok_id,
        title: v.title,
        idiomData: (() => { try { const p = JSON.parse(v.summary || ""); return p?.idiom ? p : null; } catch { return null; } })(),
      }));
      setEpisodes(eps);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (open && authed) fetchEpisodes(); }, [open, authed, fetchEpisodes]);

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [open, onClose]);
  useEffect(() => { if (open) document.body.style.overflow = "hidden"; else document.body.style.overflow = ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoginLoading(true); setLoginError("");
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: loginUser, password: loginPass }) });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || "Login failed."); return; }
      setToken(data.token); setAuthed(true); setLoginPass(""); onAuth(data.token);
    } catch { setLoginError("Network error."); }
    finally { setLoginLoading(false); }
  };

  const handleLogout = () => { setAuthed(false); setToken(""); setLoginUser(""); setLoginPass(""); setLoginError(""); setUploadResult(null); setJsonText(""); setEditingEp(null); onAuth(""); };

  const handleDelete = async (tiktokId: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch("/api/idioms/delete", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ tiktokId }) });
      const data = await res.json();
      if (res.status === 401) { onToast("Session expired.", "error"); handleLogout(); return; }
      if (!res.ok) { onToast(`Delete failed: ${data.error}`, "error"); return; }
      onToast(`🗑️ Deleted "${data.deleted}"`, "success");
      setEpisodes(eps => eps.filter(e => e.tiktok_id !== tiktokId));
      onRefresh();
    } catch { onToast("Network error.", "error"); }
  };

  const handleEditStart = (ep: { tiktok_id: string; title: string; idiomData: IdiomData | null }) => {
    setEditingEp(ep);
    setEditJson(ep.idiomData ? JSON.stringify(ep.idiomData, null, 2) : "");
    setEditResult(null);
  };

  const handleEditSave = async () => {
    if (!editingEp || !editJson.trim()) return;
    setEditSaving(true); setEditResult(null);
    try {
      const parsed = JSON.parse(editJson);
      const res = await fetch("/api/idioms/edit", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ tiktokId: editingEp.tiktok_id, data: parsed }) });
      const data = await res.json();
      if (res.status === 401) { onToast("Session expired.", "error"); handleLogout(); return; }
      if (!res.ok) { setEditResult(`❌ ${data.error}`); return; }
      setEditResult(`✅ ${data.message}`);
      setEditingEp(null);
      fetchEpisodes();
      onRefresh();
    } catch (err) { setEditResult(`❌ Invalid JSON: ${err instanceof Error ? err.message : "parse error"}`); }
    finally { setEditSaving(false); }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault(); if (!jsonText.trim()) return;
    setUploading(true); setUploadResult(null);
    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch("/api/idioms/add", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
      const data = await res.json();
      if (res.status === 401) { onToast("Session expired.", "error"); handleLogout(); return; }
      if (!res.ok) { setUploadResult(`❌ ${data.error}`); return; }
      setUploadResult(`✅ ${data.message}`);
      setJsonText("");
      onRefresh();
      fetchEpisodes();
    } catch (err) {
      setUploadResult(`❌ Invalid JSON: ${err instanceof Error ? err.message : "parse error"}`);
    } finally { setUploading(false); }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.status === 401) { onToast("Session expired.", "error"); handleLogout(); return; }
      if (!res.ok) { onToast(`Sync failed: ${data.detail ?? data.error}`, "error"); return; }
      onToast(`✅ Sync complete — ${data.newVideos} new`, "success"); onRefresh();
    } catch { onToast("Network error.", "error"); }
    finally { setSyncing(false); }
  };

  const sampleJson = `{
  "idiom": "Hit the nail on the head",
  "cefr": "B2",
  "partOfSpeech": "verb phrase",
  "episode": "EP.001",
  "date": "2024-01-08",
  "thumbnail": "🎯",
  "color": "#FF6B6B",
  "tiktokUrl": "https://www.tiktok.com/@patternspeakout/video/123",
  "definitionEN": "To be precisely correct about something.",
  "definitionTH": "พูดถูกต้องแม่นยำ / ตรงประเด็น",
  "synonyms": ["be spot on", "be exactly right"],
  "antonyms": ["miss the point", "be off the mark"],
  "keyWords": [
    {
      "word": "nail",
      "cefr": "A1",
      "pos": "noun",
      "definitionEN": "A small metal spike",
      "definitionTH": "ตะปู",
      "synonyms": ["pin", "spike"],
      "antonyms": []
    }
  ],
  "examples": [
    {
      "en": "She hit the nail on the head with her analysis.",
      "th": "เธอพูดได้ตรงประเด็นมากกับการวิเคราะห์"
    }
  ],
  "usage": "Formal & Informal",
  "context": "Work, discussion, debate"
}`;

  return (
    <>
      <div className={`admin-backdrop ${open ? "open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`admin-panel ${open ? "open" : ""}`} aria-label="Admin panel">
        <div className="admin-panel-header">
          <div className="admin-panel-title"><span>⚙️</span><span>Admin Panel</span></div>
          <button className="admin-panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="admin-panel-body">
          {!authed ? (
            <form className="admin-login-form" onSubmit={handleLogin}>
              <div className="admin-section-label">🔐 Sign in to manage</div>
              <div className="admin-field"><label className="admin-label" htmlFor="ap-user">Username</label><input id="ap-user" className="admin-input" type="text" autoComplete="username" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} required autoFocus /></div>
              <div className="admin-field"><label className="admin-label" htmlFor="ap-pass">Password</label><input id="ap-pass" className="admin-input" type="password" autoComplete="current-password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} required /></div>
              {loginError && <div className="admin-error">{loginError}</div>}
              <button className="admin-login-btn" type="submit" disabled={loginLoading}>{loginLoading ? <><span className="spin">↻</span> Signing in…</> : <>🔓 Sign in</>}</button>
            </form>
          ) : (
            <>
              <div className="admin-user-row"><div className="admin-user-badge"><span className="admin-user-dot" /><span>{loginUser}</span></div><button className="admin-logout-btn" onClick={handleLogout}>Sign out</button></div>

              {/* Upload JSON */}
              <div className="admin-card">
                <div className="admin-section-label">📝 เพิ่ม Idiom (Paste JSON)</div>
                <p className="admin-hint">สร้าง JSON จาก ChatGPT แล้ว paste ลงด้านล่าง เว็บจะแสดงข้อมูลเต็มรูปแบบเหมือนเว็บเก่า</p>
                <form onSubmit={handleUpload}>
                  <div className="admin-field">
                    <textarea className="admin-input" style={{ minHeight: 600, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.5, resize: "vertical" }}
                      value={jsonText} onChange={(e) => { setJsonText(e.target.value); setUploadResult(null); }}
                      placeholder={sampleJson} required />
                  </div>
                  <button className="admin-action-btn" type="submit" disabled={uploading || !jsonText.trim()}>
                    {uploading ? <><span className="spin">↻</span> Uploading…</> : <>➕ Add Idiom</>}
                  </button>
                  {uploadResult && <div className={`admin-result ${uploadResult.startsWith("✅") ? "ok" : "err"}`}>{uploadResult}</div>}
                </form>
              </div>

              {/* Template */}
              <div className="admin-card">
                <div className="admin-section-label">📋 JSON Template</div>
                <p className="admin-hint">ส่ง prompt นี้ให้ ChatGPT เพื่อสร้าง JSON ให้คุณ:</p>
                <div style={{ position: "relative" }}>
                  <button
                    className="copy-btn"
                    onClick={() => {
                      const text = `Please create a JSON object for the English idiom "[IDIOM]" with this exact structure:\n${sampleJson}\n\nFill in all fields with accurate data. Use Thai for definitionTH and example translations.`;
                      navigator.clipboard.writeText(text).then(() => onToast("Copied to clipboard!", "success")).catch(() => onToast("Copy failed", "error"));
                    }}
                    aria-label="Copy template to clipboard"
                    title="Copy to clipboard"
                  >
                    📋 Copy
                  </button>
                  <div style={{ background: "var(--bg-dark)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 12px 12px 12px", paddingTop: 36, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent-teal)", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
                    {`Please create a JSON object for the English idiom "[IDIOM]" with this exact structure:\n${sampleJson}\n\nFill in all fields with accurate data. Use Thai for definitionTH and example translations.`}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [filtered, setFiltered] = useState<Video[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [cefrFilter, setCefrFilter] = useState("all");
  const [selectedVideo, setSelectedVideo] = useState<{ video: Video; index: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "" }>({ msg: "", type: "" });
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  }, []);

  const fetchVideos = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); setError(null);
    try {
      const res = await fetch("/api/videos", { cache: "no-store" });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`); }
      const data: ApiResponse = await res.json();
      setVideos(data.videos); setLastSync(data.lastSync);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Unknown error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchVideos(); pollTimer.current = setInterval(() => fetchVideos(true), POLL_INTERVAL_MS); return () => { if (pollTimer.current) clearInterval(pollTimer.current); }; }, [fetchVideos]);

  // Filter & sort
  useEffect(() => {
    let result = [...videos];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(v => {
        const data = getIdiomData(v);
        return v.title.toLowerCase().includes(q) || v.caption.toLowerCase().includes(q) ||
          (data?.idiom ?? "").toLowerCase().includes(q) || (data?.definitionEN ?? "").toLowerCase().includes(q) ||
          (data?.definitionTH ?? "").toLowerCase().includes(q);
      });
    }
    if (cefrFilter !== "all") {
      result = result.filter(v => { const d = getIdiomData(v); return d?.cefr === cefrFilter; });
    }
    switch (sort) {
      case "newest": result.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()); break;
      case "oldest": result.sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime()); break;
      case "alpha": result.sort((a, b) => { const da = getIdiomData(a); const db = getIdiomData(b); return (da?.idiom ?? a.title).localeCompare(db?.idiom ?? b.title); }); break;
      case "cefr": { const o: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }; result.sort((a, b) => (o[getIdiomData(a)?.cefr ?? "B1"] ?? 3) - (o[getIdiomData(b)?.cefr ?? "B1"] ?? 3)); break; }
    }
    setFiltered(result);
  }, [videos, search, sort, cefrFilter]);

  // Particles
  const particlesRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const c = particlesRef.current; if (!c) return; for (let i = 0; i < 20; i++) { const p = document.createElement("div"); p.className = "particle"; p.style.cssText = `left:${Math.random()*100}%;animation-duration:${6+Math.random()*10}s;animation-delay:${Math.random()*8}s;width:${1+Math.random()*3}px;height:${1+Math.random()*3}px;background:${Math.random()>.5?"#ff2d55":"#ffd60a"};`; c.appendChild(p); } }, []);

  const [showTop, setShowTop] = useState(false);
  useEffect(() => { const h = () => setShowTop(window.scrollY > 400); window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h); }, []);

  return (
    <>
      {/* HERO */}
      <header className="hero">
        <div className="particles" ref={particlesRef} aria-hidden="true" />
        <a href="https://www.tiktok.com/@patternspeakout" target="_blank" rel="noopener noreferrer" className="channel-badge" style={{ textDecoration: "none" }}><span className="tiktok-logo">tt</span>@patternspeakout &nbsp;·&nbsp; Idiom of the Day</a>
        <h1><span className="gradient-text">Idiom of the Day</span><br />Vlog Summary</h1>
        <p className="subtitle">สรุปทุก Episode จาก TikTok <strong>@patternspeakout</strong> — เรียนรู้ Idiom ภาษาอังกฤษพร้อมระดับ CEFR, ความหมายไทย–อังกฤษ, Synonyms, Antonyms และตัวอย่างประโยค</p>
        <div className="hero-stats">
          <div className="stat-item"><div className="stat-number">{loading ? "…" : videos.length}</div><div className="stat-label">Episodes</div></div>
          <div className="stat-item"><div className="stat-number">A1–C2</div><div className="stat-label">CEFR Levels</div></div>
          <div className="stat-item"><div className="stat-number">🇹🇭 🇬🇧</div><div className="stat-label">Bilingual</div></div>
          <div className="stat-item"><div className="stat-number">{loading ? "…" : filtered.filter(v => getIdiomData(v)?.examples?.length).reduce((a, v) => a + (getIdiomData(v)?.examples?.length ?? 0), 0)}+</div><div className="stat-label">Examples</div></div>
        </div>
      </header>

      {/* Hamburger */}
      <button className={`hamburger-btn ${adminOpen ? "active" : ""}`} onClick={() => setAdminOpen(v => !v)} aria-label={adminOpen ? "Close admin" : "Open admin"} aria-expanded={adminOpen}>
        <span className="hamburger-line" /><span className="hamburger-line" /><span className="hamburger-line" />
      </button>

      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} onToast={showToast} onRefresh={() => fetchVideos(true)} onAuth={(t) => setAdminToken(t)} />

      {/* Status */}
      <div className="status-bar"><div className="status-bar-inner"><div className="last-updated"><span className="live-dot" /><span>อัปเดตล่าสุด: {fmtDatetime(lastSync)}</span></div></div></div>

      {/* Controls */}
      <nav className="controls-bar" aria-label="Filter and search">
        <div className="controls-inner">
          <div className="search-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา Idiom, ความหมาย, CEFR…" aria-label="ค้นหา" autoComplete="off" id="searchInput" />
          </div>
          <div className="filter-group" role="group" aria-label="CEFR filter">
            {["all", "A1", "A2", "B1", "B2", "C1", "C2"].map(level => (
              <button key={level} className={`filter-btn ${cefrFilter === level ? "active" : ""}`} data-cefr={level !== "all" ? level : undefined} onClick={() => setCefrFilter(level)}>
                {level === "all" ? "ทั้งหมด" : level}
              </button>
            ))}
          </div>
          <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="เรียงลำดับ">
            <option value="newest">Episode ล่าสุด ↓</option>
            <option value="oldest">Episode เก่าสุด ↑</option>
            <option value="alpha">A → Z</option>
            <option value="cefr">CEFR ง่าย → ยาก</option>
          </select>
        </div>
      </nav>

      {/* Main */}
      <main className="main-content">
        <div className="section-header">
          <h2 className="section-title"><span className="dot" aria-hidden="true" />All Episodes</h2>
          <div className="result-count" aria-live="polite">{loading ? "กำลังโหลด…" : `${filtered.length} idiom${filtered.length !== 1 ? "s" : ""}`}</div>
        </div>
        <div className="idiom-grid" role="list">
          {loading && <SkeletonGrid />}
          {!loading && error && (
            <div className="error-state"><span style={{ fontSize: 48 }}>⚠️</span><h3>ไม่สามารถโหลดข้อมูลได้</h3><p>{error}</p><button className="retry-btn" onClick={() => fetchVideos()}>ลองอีกครั้ง</button></div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="no-results"><span className="no-results-emoji">{search ? "🔍" : "📭"}</span><h3>{search ? "ไม่พบ Idiom ที่ค้นหา" : "ยังไม่มี Idiom"}</h3><p>{search ? "ลองค้นหาด้วยคำอื่น" : "เปิด Admin Panel (☰) แล้วเพิ่ม Idiom ใหม่"}</p></div>
          )}
          {!loading && !error && filtered.map((video, i) => (
            <VideoCard key={video.id} video={video} index={i}
              onClick={() => setSelectedVideo({ video, index: i })}
              isAdmin={!!adminToken}
              onEdit={() => setEditingVideo(video)}
              onDelete={async () => {
                const data = getIdiomData(video);
                const name = data?.idiom ?? video.title;
                if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
                try {
                  const res = await fetch("/api/idioms/delete", { method: "POST", headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ tiktokId: video.tiktok_id }) });
                  const r = await res.json();
                  if (!res.ok) { showToast(`Delete failed: ${r.error}`, "error"); return; }
                  showToast(`🗑️ Deleted "${r.deleted}"`, "success");
                  fetchVideos(true);
                } catch { showToast("Network error.", "error"); }
              }}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="footer-inner">
          <div className="footer-logo">Pattern Speak Out</div>
          <p>เว็บไซต์นี้เป็น Vlog Summary สรุปเนื้อหาจาก TikTok <a href="https://www.tiktok.com/@patternspeakout" target="_blank" rel="noopener noreferrer">@patternspeakout</a><br />เหมาะสำหรับผู้เรียนภาษาอังกฤษทุกระดับ · ข้อมูลอ้างอิงตาม CEFR Framework</p>
          <a className="footer-tiktok-link" href="https://www.tiktok.com/@patternspeakout" target="_blank" rel="noopener noreferrer"><span className="tiktok-logo" aria-hidden="true">tt</span>ดูช่องต้นฉบับบน TikTok</a>
        </div>
      </footer>

      <button id="backToTop" className={showTop ? "visible" : ""} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="กลับขึ้นด้านบน">↑</button>
      {selectedVideo && <DetailModal video={selectedVideo.video} index={selectedVideo.index} onClose={() => setSelectedVideo(null)} />}
      {editingVideo && <EditModal video={editingVideo} token={adminToken} onClose={() => setEditingVideo(null)} onSaved={() => fetchVideos(true)} onToast={showToast} />}
      <Toast msg={toast.msg} type={toast.type} />
    </>
  );
}
