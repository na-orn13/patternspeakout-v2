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
  category?: string;
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
function VideoCard({ video, index, onClick, isAdmin, onEdit, onDelete, isFav, onFav }: {
  video: Video; index: number; onClick: () => void;
  isAdmin?: boolean; onEdit?: () => void; onDelete?: () => void;
  isFav?: boolean; onFav?: () => void;
}) {
  const color = colorFor(video, index);
  const emoji = emojiFor(video, index);
  const data = getIdiomData(video);
  const cefrColor = data?.cefr ? ({ A1: "#27ae60", A2: "#2ecc71", B1: "#3498db", B2: "#a855f7", C1: "#e67e22", C2: "#e74c3c" }[data.cefr] ?? color) : color;
  const epNum = `EP.${String(index + 1).padStart(3, "0")}`;

  return (
    <div className="idiom-card" style={{ animationDelay: `${Math.min(index, 5) * 0.06}s`, borderColor: `${cefrColor}40` }}>
      <div className="card-accent-line" style={{ background: cefrColor }} />

      {/* Admin overlay buttons */}
      {isAdmin && (
        <div className="card-admin-btns">
          <button className="card-admin-btn edit" onClick={(e) => { e.stopPropagation(); onEdit?.(); }} title="Edit">✏️</button>
          <button className="card-admin-btn delete" onClick={(e) => { e.stopPropagation(); onDelete?.(); }} title="Delete">🗑️</button>
        </div>
      )}

      {/* Favourite button (visible for all logged-in users) */}
      {onFav && (
        <button className={`card-fav-btn ${isFav ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); onFav(); }} title={isFav ? "Remove from deck" : "Save to deck"} aria-label={isFav ? "Remove from deck" : "Save to deck"}>
          {isFav ? "❤️" : "🤍"}
        </button>
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
function DetailModal({ video, index, onClose, userSession, savedWordIds, onSaveWord }: { video: Video; index: number; onClose: () => void; userSession?: { id: string } | null; savedWordIds?: Set<string>; onSaveWord?: (wordId: string, wordData: Record<string, unknown>) => void }) {
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
                  <div className="word-chips">{data.synonyms.map((s, i) => {
                    const sId = `word_${s.toLowerCase().replace(/\s+/g, "_")}`;
                    const sSaved = savedWordIds?.has(sId);
                    return <span key={i} className={`chip chip-syn ${onSaveWord ? "clickable" : ""} ${sSaved ? "saved" : ""}`}
                      onClick={() => onSaveWord && !sSaved && onSaveWord(sId, { word: s, cefr: data.cefr, pos: data.partOfSpeech, definitionEN: `Synonym of "${data.idiom}"`, definitionTH: `คำพ้องของ "${data.idiom}"` })}
                    >{s}{onSaveWord && !sSaved && " +"}</span>;
                  })}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10, fontWeight: 600 }}>❌ Antonyms (คำตรงข้าม)</div>
                  <div className="word-chips">{data.antonyms.map((a, i) => {
                    const aId = `word_${a.toLowerCase().replace(/\s+/g, "_")}`;
                    const aSaved = savedWordIds?.has(aId);
                    return <span key={i} className={`chip chip-ant ${onSaveWord ? "clickable" : ""} ${aSaved ? "saved" : ""}`}
                      onClick={() => onSaveWord && !aSaved && onSaveWord(aId, { word: a, cefr: data.cefr, pos: data.partOfSpeech, definitionEN: `Antonym of "${data.idiom}"`, definitionTH: `คำตรงข้ามของ "${data.idiom}"` })}
                    >{a}{onSaveWord && !aSaved && " +"}</span>;
                  })}</div>
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
                    {data.keyWords.map((kw, i) => {
                      const wordId = `word_${kw.word.toLowerCase().replace(/\s+/g, "_")}`;
                      const isSaved = savedWordIds?.has(wordId);
                      return (
                      <div key={i} className="keyword-card">
                        <div className="keyword-header">
                          <div className="keyword-word">{kw.word}</div>
                          <div className="keyword-badges">
                            <span className={`tag tag-cefr ${kw.cefr}`}>{kw.cefr}</span>
                            <span className="tag tag-pos">{kw.pos}</span>
                            {onSaveWord && (
                              <button className={`word-save-btn ${isSaved ? "saved" : ""}`}
                                onClick={() => !isSaved && onSaveWord(wordId, { word: kw.word, cefr: kw.cefr, pos: kw.pos, definitionEN: kw.definitionEN, definitionTH: kw.definitionTH, synonyms: kw.synonyms, antonyms: kw.antonyms })}
                                title={isSaved ? "Already in deck" : "Save to deck"}>
                                {isSaved ? "✅" : "➕"}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="keyword-def-en">🇬🇧 {kw.definitionEN}</div>
                        <div className="keyword-def-th">🇹🇭 {kw.definitionTH}</div>
                        {kw.synonyms.length > 0 && (
                          <div className="keyword-syn-row">
                            <div className="keyword-syn-label">Synonyms</div>
                            <div className="mini-chips">{kw.synonyms.map((s, j) => {
                              const sId = `word_${s.toLowerCase().replace(/\s+/g, "_")}`;
                              const sSaved = savedWordIds?.has(sId);
                              return <span key={j} className={`mini-chip mini-chip-syn ${onSaveWord ? "clickable" : ""} ${sSaved ? "saved" : ""}`}
                                onClick={() => onSaveWord && !sSaved && onSaveWord(sId, { word: s, cefr: kw.cefr, pos: kw.pos, definitionEN: `Synonym of "${kw.word}"`, definitionTH: `คำพ้องของ "${kw.word}"` })}
                              >{s}{onSaveWord && !sSaved && " +"}</span>;
                            })}</div>
                          </div>
                        )}
                        {kw.antonyms.length > 0 && (
                          <div className="keyword-ant-row">
                            <div className="keyword-ant-label">Antonyms</div>
                            <div className="mini-chips">{kw.antonyms.map((a, j) => {
                              const aId = `word_${a.toLowerCase().replace(/\s+/g, "_")}`;
                              const aSaved = savedWordIds?.has(aId);
                              return <span key={j} className={`mini-chip mini-chip-ant ${onSaveWord ? "clickable" : ""} ${aSaved ? "saved" : ""}`}
                                onClick={() => onSaveWord && !aSaved && onSaveWord(aId, { word: a, cefr: kw.cefr, pos: kw.pos, definitionEN: `Antonym of "${kw.word}"`, definitionTH: `คำตรงข้ามของ "${kw.word}"` })}
                              >{a}{onSaveWord && !aSaved && " +"}</span>;
                            })}</div>
                          </div>
                        )}
                      </div>
                      );
                    })}
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

// ─── Side Panel (Login/Register/Admin/Deck) ──────────────────────────────────
interface SidePanelProps {
  open: boolean; onClose: () => void;
  onToast: (msg: string, type: "success"|"error") => void;
  onRefresh: () => void;
  onAuth: (token: string, role: "admin"|"user"|"") => void;
  userSession: { id: string; email: string; displayName: string; role: "admin"|"user" } | null;
  adminToken: string;
  videos: Video[];
  favourites: Set<string>;
  savedWords: Array<{ id: string; data: Record<string, unknown> }>;
  onToggleFav: (tiktokId: string) => void;
  onRemoveWord: (wordId: string) => void;
  addCategory: string;
}

function SidePanel({ open, onClose, onToast, onRefresh, onAuth, userSession, adminToken, videos, favourites, savedWords, onToggleFav, onRemoveWord, addCategory }: SidePanelProps) {
  const [tab, setTab] = useState<"login"|"register"|"admin"|"deck"|"users">("login");
  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  // Register
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regAge, setRegAge] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regResult, setRegResult] = useState<string|null>(null);
  // Admin: add idiom
  const [jsonText, setJsonText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string|null>(null);
  // Admin: user management
  const [users, setUsers] = useState<Array<{id:string;email:string;display_name:string;full_name:string;age:number|null;phone:string;role:string;status:string;expires_at:string|null;created_at:string}>>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [open, onClose]);
  useEffect(() => { if (open) document.body.style.overflow = "hidden"; else document.body.style.overflow = ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  // Set initial tab based on session
  useEffect(() => {
    if (userSession?.role === "admin") setTab("admin");
    else if (userSession) setTab("deck");
    else setTab("login");
  }, [userSession]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoginLoading(true); setLoginError("");
    try {
      // Try admin login first
      const adminRes = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: loginEmail, password: loginPass }) });
      if (adminRes.ok) {
        const data = await adminRes.json();
        onAuth(data.token, "admin");
        setLoginEmail(""); setLoginPass("");
        setTab("admin");
        return;
      }
      // Try user login
      const res = await fetch("/api/users/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: loginEmail, password: loginPass }) });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error); return; }
      onAuth(data.token, "user");
      setLoginEmail(""); setLoginPass("");
      setTab("deck");
    } catch { setLoginError("Network error."); }
    finally { setLoginLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setRegLoading(true); setRegResult(null);
    try {
      const res = await fetch("/api/users/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: regEmail, password: regPass, displayName: regName, fullName: regName, age: parseInt(regAge) || 0, phone: regPhone }) });
      const data = await res.json();
      if (!res.ok) { setRegResult(`❌ ${data.error}`); return; }
      setRegResult(`✅ ${data.message}`);
      setRegEmail(""); setRegPass(""); setRegName(""); setRegAge(""); setRegPhone("");
    } catch { setRegResult("❌ Network error."); }
    finally { setRegLoading(false); }
  };

  const handleLogout = () => { if (confirm("Do you want to log out?")) { onAuth("", ""); setTab("login"); } };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault(); if (!jsonText.trim()) return;
    setUploading(true); setUploadResult(null);
    try {
      const parsed = JSON.parse(jsonText);
      // Auto-inject category if not specified
      if (!parsed.category) parsed.category = addCategory;
      const res = await fetch("/api/idioms/add", { method: "POST", headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
      const data = await res.json();
      if (!res.ok) { setUploadResult(`❌ ${data.error}`); return; }
      setUploadResult(`✅ ${data.message}`); setJsonText(""); onRefresh();
    } catch (err) { setUploadResult(`❌ Invalid JSON: ${err instanceof Error ? err.message : "parse error"}`); }
    finally { setUploading(false); }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users/manage", { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await res.json();
      if (res.ok) setUsers(data.users ?? []);
    } catch { /* ignore */ }
    finally { setUsersLoading(false); }
  };

  const handleUserAction = async (userId: string, action: string, extraValue?: string) => {
    try {
      const body: Record<string, unknown> = { userId, action };
      if (action === "set_expiry") body.expiresAt = extraValue || null;
      if (action === "reset_password") body.newPassword = extraValue;
      const res = await fetch("/api/users/manage", { method: "POST", headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) { onToast(`✅ ${data.message}`, "success"); fetchUsers(); }
      else onToast(`❌ ${data.error}`, "error");
    } catch { onToast("Network error.", "error"); }
  };

  // Deck: get favourite videos
  const deckVideos = videos.filter(v => favourites.has(v.tiktok_id));

  const sampleJson = `{
  "idiom": "Hit the nail on the head",
  "cefr": "B2",
  "partOfSpeech": "verb phrase",
  "category": "${addCategory}",
  "date": "2024-01-08",
  "thumbnail": "🎯",
  "color": "#FF6B6B",
  "tiktokUrl": "",
  "definitionEN": "To be precisely correct.",
  "definitionTH": "พูดถูกต้องแม่นยำ",
  "synonyms": ["be spot on", "be exactly right"],
  "antonyms": ["miss the point"],
  "keyWords": [{"word":"nail","cefr":"A1","pos":"noun","definitionEN":"A metal spike","definitionTH":"ตะปู","synonyms":["pin"],"antonyms":[]}],
  "examples": [{"en":"She hit the nail on the head.","th":"เธอพูดได้ตรงประเด็น"}],
  "usage": "Formal & Informal",
  "context": "Work, discussion"
}`;

  return (
    <>
      <div className={`admin-backdrop ${open ? "open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`admin-panel ${open ? "open" : ""}`} aria-label="Side panel">
        <div className="admin-panel-header">
          <div className="admin-panel-title"><span>⚙️</span><span>{userSession ? userSession.displayName : "Sign in"}</span></div>
          <button className="admin-panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tab nav (only when logged in) */}
        {userSession && (
          <div className="panel-tabs">
            {userSession.role === "admin" && <button className={`panel-tab ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>📝 Admin</button>}
            {userSession.role === "admin" && <button className={`panel-tab ${tab === "users" ? "active" : ""}`} onClick={() => { setTab("users"); fetchUsers(); }}>👥 Users</button>}
            <button className={`panel-tab ${tab === "deck" ? "active" : ""}`} onClick={() => setTab("deck")}>💾 My Deck</button>
            <button className="panel-tab" onClick={handleLogout}>🚪</button>
          </div>
        )}

        <div className="admin-panel-body">
          {/* ─── Not logged in: Login / Register ─── */}
          {!userSession && (
            <>
              <div className="panel-tabs" style={{ marginBottom: 16 }}>
                <button className={`panel-tab ${tab === "login" ? "active" : ""}`} onClick={() => setTab("login")}>Sign in</button>
                <button className={`panel-tab ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>Register</button>
              </div>

              {tab === "login" && (
                <form className="admin-login-form" onSubmit={handleLogin}>
                  <div className="admin-field"><label className="admin-label" htmlFor="sp-email">Email</label><input id="sp-email" className="admin-input" type="text" autoComplete="username" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required autoFocus /></div>
                  <div className="admin-field"><label className="admin-label" htmlFor="sp-pass">Password</label><input id="sp-pass" className="admin-input" type="password" autoComplete="current-password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required /></div>
                  {loginError && <div className="admin-error">{loginError}</div>}
                  <button className="admin-login-btn" type="submit" disabled={loginLoading}>{loginLoading ? <><span className="spin">↻</span> Signing in…</> : <>🔓 Sign in</>}</button>
                </form>
              )}

              {tab === "register" && (
                <form className="admin-login-form" onSubmit={handleRegister}>
                  <div className="admin-field"><label className="admin-label" htmlFor="sp-reg-name">Full Name *</label><input id="sp-reg-name" className="admin-input" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Your full name" required /></div>
                  <div className="admin-field"><label className="admin-label" htmlFor="sp-reg-age">Age *</label><input id="sp-reg-age" className="admin-input" type="number" min="1" max="120" value={regAge} onChange={e => setRegAge(e.target.value)} placeholder="25" required /></div>
                  <div className="admin-field"><label className="admin-label" htmlFor="sp-reg-phone">Phone Number *</label><input id="sp-reg-phone" className="admin-input" type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="0812345678" required /></div>
                  <div className="admin-field"><label className="admin-label" htmlFor="sp-reg-email">Email *</label><input id="sp-reg-email" className="admin-input" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required placeholder="you@email.com" /></div>
                  <div className="admin-field"><label className="admin-label" htmlFor="sp-reg-pass">Password (min 6 chars) *</label><input id="sp-reg-pass" className="admin-input" type="password" value={regPass} onChange={e => setRegPass(e.target.value)} required minLength={6} /></div>
                  {regResult && <div className={`admin-result ${regResult.startsWith("✅") ? "ok" : "err"}`}>{regResult}</div>}
                  <button className="admin-login-btn" type="submit" disabled={regLoading}>{regLoading ? <><span className="spin">↻</span> Registering…</> : <>📝 Register</>}</button>
                  <p className="admin-hint" style={{ marginTop: 8 }}>After registering, admin must approve your account before you can sign in.</p>
                </form>
              )}
            </>
          )}

          {/* ─── Deck tab ─── */}
          {userSession && tab === "deck" && (
            <div>
              <div className="admin-section-label">💾 My Deck</div>
              <p className="admin-hint" style={{ marginBottom: 16 }}>
                ดูและทบทวนคำศัพท์ที่บันทึกไว้ในหน้า Deck — พร้อมโหมด Flashcard และแยกตาม CEFR
              </p>
              <a href="/deck" className="deck-flashcard-btn" style={{ textDecoration: "none", display: "inline-flex" }}>
                🃏 Open My Deck
              </a>

              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Quick View — ❤️ Saved Idioms ({deckVideos.length})</div>
                {deckVideos.length === 0 ? (
                  <p className="admin-hint">กด ❤️ บนการ์ดเพื่อบันทึก idiom</p>
                ) : (
                  <div className="admin-episode-list">
                    {deckVideos.slice(0, 5).map(v => {
                      const d = getIdiomData(v);
                      return (
                        <div key={v.tiktok_id} className="admin-ep-row">
                          <div className="admin-ep-info">
                            <span className="admin-ep-emoji">{d?.thumbnail ?? "📖"}</span>
                            <div>
                              <div className="admin-ep-name">{d?.idiom ?? v.title}</div>
                              <div className="admin-ep-meta">{d?.cefr ?? ""}</div>
                            </div>
                          </div>
                          <button className="admin-ep-btn delete" onClick={() => onToggleFav(v.tiktok_id)} title="Remove">✕</button>
                        </div>
                      );
                    })}
                    {deckVideos.length > 5 && <p className="admin-hint" style={{ textAlign: "center" }}>+{deckVideos.length - 5} more — open full deck to see all</p>}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>📝 Saved Words ({savedWords.length})</div>
                {savedWords.length === 0 ? (
                  <p className="admin-hint">กดคำศัพท์ในรายละเอียด idiom เพื่อบันทึก</p>
                ) : (
                  <p className="admin-hint">{savedWords.length} words saved — <a href="/deck" style={{ color: "var(--accent-teal)" }}>open deck</a> to review</p>
                )}
              </div>
            </div>
          )}

          {/* ─── Admin: Add idiom ─── */}
          {userSession?.role === "admin" && tab === "admin" && (
            <>
              <div className="admin-card">
                <div className="admin-section-label">📝 เพิ่ม {addCategory === "idiom" ? "Idiom" : addCategory === "howtosay" ? "How to Say" : "Motto"} (Paste JSON)</div>
                <p className="admin-hint">สร้าง JSON จาก ChatGPT แล้ว paste ลงด้านล่าง — category: <strong>{addCategory}</strong> (จะถูกเพิ่มอัตโนมัติ)</p>
                <form onSubmit={handleUpload}>
                  <div className="admin-field">
                    <textarea className="admin-input" style={{ minHeight: 600, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.5, resize: "vertical" }}
                      value={jsonText} onChange={e => { setJsonText(e.target.value); setUploadResult(null); }} placeholder={sampleJson} required />
                  </div>
                  <button className="admin-action-btn" type="submit" disabled={uploading || !jsonText.trim()}>
                    {uploading ? <><span className="spin">↻</span> Uploading…</> : <>➕ Add Idiom</>}
                  </button>
                  {uploadResult && <div className={`admin-result ${uploadResult.startsWith("✅") ? "ok" : "err"}`}>{uploadResult}</div>}
                </form>
              </div>

              <div className="admin-card">
                <div className="admin-section-label">📋 JSON Template</div>
                <p className="admin-hint">ส่ง prompt นี้ให้ ChatGPT เพื่อสร้าง JSON ให้คุณ:</p>
                <div style={{ position: "relative" }}>
                  <button className="copy-btn" onClick={() => {
                    const text = `Please create a JSON object for the English idiom "[IDIOM]" with this exact structure:\n${sampleJson}\n\nFill in all fields with accurate data. Use Thai for definitionTH and example translations.`;
                    navigator.clipboard.writeText(text).then(() => onToast("Copied!", "success")).catch(() => onToast("Copy failed", "error"));
                  }} aria-label="Copy">📋 Copy</button>
                  <div style={{ background: "var(--bg-dark)", border: "1px solid var(--border)", borderRadius: 8, padding: "36px 12px 12px", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent-teal)", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
                    {`Please create a JSON object for the English idiom "[IDIOM]" with this exact structure:\n${sampleJson}\n\nFill in all fields with accurate data. Use Thai for definitionTH and example translations.`}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ─── Admin: User management ─── */}
          {userSession?.role === "admin" && tab === "users" && (
            <div>
              <div className="admin-section-label">👥 User Management ({users.length})</div>
              {usersLoading ? <p className="admin-hint">Loading…</p> : (
                <div className="admin-episode-list" style={{ maxHeight: 500 }}>
                  {users.map(u => (
                    <div key={u.id} className="admin-ep-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div className="admin-ep-name">{u.full_name || u.display_name || u.email}</div>
                          <div className="admin-ep-meta">{u.email} · {u.phone ? `📱${u.phone}` : ""} · {u.age ? `${u.age}y` : ""} · <span style={{ color: u.status === "approved" ? "var(--accent-teal)" : u.status === "pending" ? "var(--accent-yellow)" : "var(--accent2)" }}>{u.status}</span></div>
                          {u.expires_at && <div className="admin-ep-meta">Expires: {new Date(u.expires_at).toLocaleDateString("th-TH")}</div>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                        {u.status === "pending" && <button className="edit-add-btn" onClick={() => handleUserAction(u.id, "approve")}>✅ Approve</button>}
                        {u.status === "approved" && <button className="edit-add-btn" style={{ borderColor: "rgba(255,45,85,0.25)", color: "var(--accent2)", background: "rgba(255,45,85,0.08)" }} onClick={() => handleUserAction(u.id, "remove")}>🚫 Remove</button>}
                        {u.status === "removed" && <button className="edit-add-btn" onClick={() => handleUserAction(u.id, "approve")}>↩️ Reactivate</button>}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <input type="date" className="edit-input" style={{ width: 140, padding: "4px 8px", fontSize: 11 }}
                            defaultValue={u.expires_at ? u.expires_at.split("T")[0] : ""}
                            onChange={(e) => handleUserAction(u.id, "set_expiry", e.target.value || undefined)}
                          />
                          {u.expires_at && <button className="edit-remove-btn" style={{ width: 22, height: 22, fontSize: 10 }} onClick={() => handleUserAction(u.id, "set_expiry")} title="Remove expiry">✕</button>}
                        </span>
                        <button className="edit-add-btn" style={{ borderColor: "rgba(255,45,85,0.25)", color: "var(--accent2)", background: "rgba(255,45,85,0.08)" }} onClick={() => {
                          if (confirm(`Permanently delete ${u.email}? This cannot be undone.`)) handleUserAction(u.id, "delete");
                        }}>🗑️ Delete</button>
                        <button className="edit-add-btn" onClick={() => {
                          const pw = prompt(`Set new password for ${u.email} (min 6 chars):`);
                          if (!pw) return;
                          if (pw.length < 6) { onToast("Password must be at least 6 characters.", "error"); return; }
                          handleUserAction(u.id, "reset_password", pw);
                        }}>🔑 Reset Password</button>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && <p className="admin-hint" style={{ textAlign: "center", padding: 16 }}>No users yet.</p>}
                </div>
              )}
            </div>
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
  const [category, setCategory] = useState("all");
  const [addCategory, setAddCategory] = useState("idiom");
  const [selectedVideo, setSelectedVideo] = useState<{ video: Video; index: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "" }>({ msg: "", type: "" });
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [userSession, setUserSession] = useState<{ id: string; email: string; displayName: string; role: "admin"|"user" } | null>(null);
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [savedWords, setSavedWords] = useState<Array<{ id: string; data: Record<string, unknown> }>>([]);
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
    // Category filter
    if (category !== "all") {
      result = result.filter(v => {
        const data = getIdiomData(v);
        const cat = data ? (data as unknown as Record<string, string>).category : undefined;
        // Default category for existing idioms is "idiom"
        const itemCat = cat || "idiom";
        return itemCat === category;
      });
    }
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
  }, [videos, search, sort, cefrFilter, category]);

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
        <a href="https://www.tiktok.com/@patternspeakout" target="_blank" rel="noopener noreferrer" className="channel-badge" style={{ textDecoration: "none" }}><span className="tiktok-logo">tt</span>@patternspeakout</a>
        <h1><span className="gradient-text">Pattern SpeakOut</span></h1>
        <p className="subtitle">เรียนรู้ภาษาอังกฤษจาก TikTok <strong>@patternspeakout</strong> — Idiom, วิธีพูด, และแรงบันดาลใจ พร้อม CEFR, ความหมายไทย–อังกฤษ และตัวอย่างประโยค</p>
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

      <SidePanel open={adminOpen} onClose={() => setAdminOpen(false)} onToast={showToast} onRefresh={() => fetchVideos(true)}
        onAuth={(t, role) => {
          if (role === "admin") { setAdminToken(t); setUserSession({ id: "admin", email: "admin", displayName: "admin_pimjaa13", role: "admin" }); sessionStorage.setItem("deck_userId", "admin"); }
          else if (role === "user" && t) {
            setAdminToken("");
            // Fetch user info from token (user UUID)
            fetch(`/api/favourites?userId=${t}`).then(r => r.json()).then(d => { if (d.favourites) setFavourites(new Set(d.favourites)); if (d.words) setSavedWords(d.words); });
            setUserSession({ id: t, email: "", displayName: "User", role: "user" });
            sessionStorage.setItem("deck_userId", t);
          } else { setAdminToken(""); setUserSession(null); setFavourites(new Set()); setSavedWords([]); sessionStorage.removeItem("deck_userId"); }
        }}
        userSession={userSession} adminToken={adminToken} videos={videos} favourites={favourites} savedWords={savedWords}
        onToggleFav={async (tiktokId) => {
          if (!userSession) return;
          const isFav = favourites.has(tiktokId);
          const action = isFav ? "remove" : "add";
          try {
            await fetch("/api/favourites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: userSession.id, tiktokId, action }) });
            setFavourites(prev => { const next = new Set(prev); if (isFav) next.delete(tiktokId); else next.add(tiktokId); return next; });
          } catch { /* ignore */ }
        }}
        onRemoveWord={async (wordId) => {
          if (!userSession) return;
          try {
            await fetch("/api/favourites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: userSession.id, tiktokId: wordId, action: "remove", itemType: "word" }) });
            setSavedWords(prev => prev.filter(w => w.id !== wordId));
          } catch { /* ignore */ }
        }}
        addCategory={addCategory}
      />

      {/* Status */}
      <div className="status-bar"><div className="status-bar-inner">
        <div className="last-updated"><span className="live-dot" /><span>อัปเดตล่าสุด: {fmtDatetime(lastSync)}</span></div>
        {userSession && <a href="/deck" className="deck-page-btn">🃏 My Deck</a>}
      </div></div>

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
        {/* Category tabs */}
        <div className="category-tabs">
          <button className={`category-tab ${category === "all" ? "active" : ""}`} onClick={() => setCategory("all")}>📚 All</button>
          <button className={`category-tab ${category === "idiom" ? "active" : ""}`} onClick={() => setCategory("idiom")}>🎯 Idiom of the Day</button>
          {adminToken && <button className="category-add-btn" onClick={() => { setCategory("idiom"); setAdminOpen(true); setAddCategory("idiom"); }} title="Add Idiom">➕</button>}
          <button className={`category-tab ${category === "howtosay" ? "active" : ""}`} onClick={() => setCategory("howtosay")}>🗣️ How to Say</button>
          {adminToken && <button className="category-add-btn" onClick={() => { setCategory("howtosay"); setAdminOpen(true); setAddCategory("howtosay"); }} title="Add How to Say">➕</button>}
          <button className={`category-tab ${category === "motto" ? "active" : ""}`} onClick={() => setCategory("motto")}>💪 Motto Motivation</button>
          {adminToken && <button className="category-add-btn" onClick={() => { setCategory("motto"); setAdminOpen(true); setAddCategory("motto"); }} title="Add Motto">➕</button>}
        </div>

        <div className="section-header">
          <h2 className="section-title"><span className="dot" aria-hidden="true" />{category === "all" ? "All Episodes" : category === "idiom" ? "Idiom of the Day" : category === "howtosay" ? "How to Say" : "Motto Motivation"}</h2>
          <div className="result-count" aria-live="polite">{loading ? "กำลังโหลด…" : `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`}</div>
        </div>
        <div className="idiom-grid" role="list">
          {loading && <SkeletonGrid />}
          {!loading && error && (
            <div className="error-state"><span style={{ fontSize: 48 }}>⚠️</span><h3>ไม่สามารถโหลดข้อมูลได้</h3><p>{error}</p><button className="retry-btn" onClick={() => fetchVideos()}>ลองอีกครั้ง</button></div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="no-results"><span className="no-results-emoji">{search ? "🔍" : "📭"}</span><h3>{search ? "ไม่พบ Idiom ที่ค้นหา" : "ยังไม่มี Idiom"}</h3><p>{search ? "ลองค้นหาด้วยคำอื่น" : "Sign in (☰) แล้วเพิ่ม Idiom ใหม่"}</p></div>
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
              isFav={favourites.has(video.tiktok_id)}
              onFav={userSession ? async () => {
                const isFav = favourites.has(video.tiktok_id);
                const action = isFav ? "remove" : "add";
                try {
                  await fetch("/api/favourites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: userSession.id, tiktokId: video.tiktok_id, action }) });
                  setFavourites(prev => { const next = new Set(prev); if (isFav) next.delete(video.tiktok_id); else next.add(video.tiktok_id); return next; });
                } catch { /* ignore */ }
              } : undefined}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer>
        <div className="footer-inner">
          <div className="footer-logo">patternspeakout</div>
          <p>สรุปเนื้อหาจาก TikTok <a href="https://www.tiktok.com/@patternspeakout" target="_blank" rel="noopener noreferrer">@patternspeakout</a><br />เหมาะสำหรับผู้เรียนภาษาอังกฤษทุกระดับ · ข้อมูลอ้างอิงตาม CEFR Framework</p>
          <a className="footer-tiktok-link" href="https://www.tiktok.com/@patternspeakout" target="_blank" rel="noopener noreferrer"><span className="tiktok-logo" aria-hidden="true">tt</span>ดูช่องต้นฉบับบน TikTok</a>
        </div>
      </footer>

      <button id="backToTop" className={showTop ? "visible" : ""} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="กลับขึ้นด้านบน">↑</button>
      {selectedVideo && <DetailModal video={selectedVideo.video} index={selectedVideo.index} onClose={() => setSelectedVideo(null)}
        userSession={userSession}
        savedWordIds={new Set(savedWords.map(w => w.id))}
        onSaveWord={userSession ? async (wordId, wordData) => {
          try {
            await fetch("/api/favourites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: userSession.id, tiktokId: wordId, action: "add", itemType: "word", wordData }) });
            setSavedWords(prev => [...prev, { id: wordId, data: wordData }]);
            showToast(`📝 "${(wordData as {word?:string}).word}" saved to deck!`, "success");
          } catch { /* ignore */ }
        } : undefined}
      />}
      {editingVideo && <EditModal video={editingVideo} token={adminToken} onClose={() => setEditingVideo(null)} onSaved={() => fetchVideos(true)} onToast={showToast} />}
      <Toast msg={toast.msg} type={toast.type} />
    </>
  );
}
