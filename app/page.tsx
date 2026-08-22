"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface KeyWord {
  word: string;
  cefr: string;
  pos: string;
  definitionEN: string;
  definitionTH: string;
  synonyms: (string | RichWord)[];
  antonyms: (string | RichWord)[];
}

interface RichWord {
  word: string;
  meaningTH: string;
  meaningEN?: string;
  pos?: string;
  example?: string;
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
  synonyms: (string | RichWord)[];
  antonyms: (string | RichWord)[];
  keyWords: KeyWord[];
  examples: Example[];
  usage: string;
  context: string;
}

// Helper: normalize a synonym/antonym item (backward compat with old string format)
function toRichWord(item: string | RichWord): RichWord {
  if (typeof item === "string") return { word: item, meaningTH: "", pos: "", example: "" };
  return item;
}
function getWordLabel(item: string | RichWord): string {
  return typeof item === "string" ? item : item.word;
}
function getWordTH(item: string | RichWord): string {
  return typeof item === "string" ? "" : (item.meaningTH || "");
}

// Text-to-speech helper (uses browser built-in Web Speech API — free, no API key)
function getVoice(lang: "en" | "th"): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  if (lang === "th") {
    return voices.find(v => v.lang.startsWith("th") && v.name.includes("Google")) ??
      voices.find(v => v.lang.startsWith("th") && v.localService === false) ??
      voices.find(v => v.lang.startsWith("th"));
  }
  return voices.find(v => v.lang.startsWith("en") && /Natural|Premium|Enhanced/i.test(v.name)) ??
    voices.find(v => v.lang.startsWith("en") && v.name.includes("Samantha")) ??
    voices.find(v => v.lang.startsWith("en") && v.name.includes("Daniel")) ??
    voices.find(v => v.lang.startsWith("en-US") && v.name.includes("Google")) ??
    voices.find(v => v.lang.startsWith("en-GB") && v.name.includes("Google")) ??
    voices.find(v => v.lang.startsWith("en") && v.localService === false) ??
    voices.find(v => v.lang.startsWith("en-US")) ??
    voices.find(v => v.lang.startsWith("en"));
}

function speakWord(text: string, lang: "en" | "th" = "en") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === "th" ? "th-TH" : "en-US";
  utterance.rate = lang === "th" ? 0.9 : 0.82;
  utterance.pitch = lang === "th" ? 1.0 : 1.05;
  const preferred = getVoice(lang);
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

function speakThai(text: string) { speakWord(text, "th"); }

// Bilingual segmentation: detects Thai (\u0E00-\u0E7F) vs English segments
// Plays them consecutively with the correct voice for each segment
function segmentBilingual(text: string): Array<{ text: string; lang: "en" | "th" }> {
  const thaiRange = /[\u0E00-\u0E7F]/;
  const segments: Array<{ text: string; lang: "en" | "th" }> = [];
  let current = "";
  let currentLang: "en" | "th" = "en";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isThai = thaiRange.test(ch);
    const charLang: "en" | "th" = isThai ? "th" : "en";

    if (current.length === 0) {
      currentLang = charLang;
      current = ch;
    } else if (charLang === currentLang || /[\s''""'"`.,!?;:\-–—()[\]{}\/]/.test(ch)) {
      // Same language or punctuation/whitespace: keep accumulating
      current += ch;
    } else {
      // Language switch
      const trimmed = current.trim();
      if (trimmed) segments.push({ text: trimmed, lang: currentLang });
      current = ch;
      currentLang = charLang;
    }
  }
  const trimmed = current.trim();
  if (trimmed) segments.push({ text: trimmed, lang: currentLang });
  return segments;
}

function speakBilingual(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const segments = segmentBilingual(text);
  if (segments.length === 0) return;

  // If all segments are one language, just speak directly
  if (segments.length === 1) {
    speakWord(segments[0].text, segments[0].lang);
    return;
  }

  // Queue segments: each speaks after the previous finishes
  let i = 0;
  function speakNext() {
    if (i >= segments.length) return;
    const seg = segments[i];
    i++;
    const utterance = new SpeechSynthesisUtterance(seg.text);
    utterance.lang = seg.lang === "th" ? "th-TH" : "en-US";
    utterance.rate = seg.lang === "th" ? 0.9 : 0.82;
    utterance.pitch = seg.lang === "th" ? 1.0 : 1.05;
    const preferred = getVoice(seg.lang);
    if (preferred) utterance.voice = preferred;
    utterance.onend = speakNext;
    window.speechSynthesis.speak(utterance);
  }
  speakNext();
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

// ─── Article types ──────────────────────────────────────────────────────────
// Articles reuse the same `videos` table + `summary` JSON model as idioms.
// An article keeps `idiom` (=title) and `definitionEN`/`definitionTH` (=short
// summary) populated so getIdiomData recognises it, and adds article fields.
interface ArticleVocab {
  phrase: string;        // exact word/phrase as it appears in the passage
  headword: string;      // normalised dictionary form
  cefr: string;
  pos: string;
  meaningEN: string;
  meaningTH: string;
  exampleEN: string;
  exampleTH: string;
  pronunciation?: string; // if different from displayed form
  forms?: string[];       // optional: extra word forms to highlight (irregulars)
}

interface ArticleData extends IdiomData {
  isArticle: true;
  author?: string;
  source?: string;          // reference / source of data
  readingTime?: string;     // e.g. "6 min"
  articleCategory?: string;  // e.g. "Technology & Society"
  bodyEN: string[];         // paragraphs (English)
  bodyTH: string[];         // paragraphs (Thai)
  vocabulary: ArticleVocab[];
}

function isArticleData(d: IdiomData | null): d is ArticleData {
  return !!d && (d as ArticleData).isArticle === true;
}

const CEFR_COLOR_MAP: Record<string, string> = { A1: "#27ae60", A2: "#2ecc71", B1: "#3498db", B2: "#a855f7", C1: "#e67e22", C2: "#e74c3c" };
const VALID_CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"];
const ARTICLE_CATEGORIES = ["Technology & Society", "Grammar", "Vocabulary", "Pronunciation", "Culture", "Learning Tips", "Business", "Science", "Health", "Environment"];

// The EXACT JSON schema this website imports for an article (stored in videos.summary).
const ARTICLE_SCHEMA_JSON = `{
  "isArticle": true,
  "category": "articles",
  "idiom": "<ARTICLE TITLE — keep this field name>",
  "cefr": "<A1|A2|B1|B2|C1|C2 — overall level>",
  "partOfSpeech": "article",
  "articleCategory": "<one of: Technology & Society, Grammar, Vocabulary, Pronunciation, Culture, Learning Tips, Business, Science, Health, Environment>",
  "author": "<writer name or 'Original content'>",
  "source": "<reference/source of data, journal, URL, or 'Original content'>",
  "readingTime": "<e.g. 6 min>",
  "date": "<YYYY-MM-DD>",
  "thumbnail": "📰",
  "definitionEN": "<one-sentence English summary shown on the card>",
  "definitionTH": "<one-sentence Thai summary>",
  "bodyEN": ["<English paragraph 1>", "<English paragraph 2>", "..."],
  "bodyTH": ["<Thai paragraph 1 — natural translation, same order>", "<Thai paragraph 2>", "..."],
  "vocabulary": [
    {
      "phrase": "<EXACT word/phrase as it appears in bodyEN>",
      "headword": "<normalised dictionary form>",
      "cefr": "<A1|A2|B1|B2|C1|C2>",
      "pos": "<part of speech>",
      "meaningEN": "<concise English meaning>",
      "meaningTH": "<natural Thai meaning>",
      "exampleEN": "<English example sentence — should contain the word, any form>",
      "exampleTH": "<Thai translation of the example>",
      "pronunciation": "<optional: pronunciation text if different from phrase>",
      "forms": ["<optional: extra inflected/irregular forms to highlight, e.g. went, gone>"]
    }
  ],
  "synonyms": [],
  "antonyms": [],
  "keyWords": [],
  "examples": [],
  "usage": "",
  "context": ""
}`;

const ARTICLE_AI_PROMPT = `Refine the draft below into a clear bilingual learning article for this website.

Requirements:
- Preserve the author's main argument and voice while correcting grammar, repetition, and unnatural phrasing.
- Produce polished English and a natural Thai translation.
- Assign an overall CEFR level (A1–C2).
- Split the article into paragraphs. bodyEN and bodyTH MUST have the same number of paragraphs, in the same order.
- Select useful CEFR vocabulary from EXACT phrases appearing in the final English passage (bodyEN).
- For each vocabulary item, provide its CEFR level, part of speech, concise English and Thai meanings, an English example, and its Thai translation. Each highlighted vocabulary can be clicked to add to the flashcard deck.
- Do not annotate words that do not appear in the final passage. The "phrase" value MUST match the text in bodyEN exactly.
- Keep the "idiom" field name for the title, and set "isArticle": true and "category": "articles".
- Return valid RAW JSON matching the schema below ONLY. Do NOT include Markdown, code fences, comments, or explanatory text.
- Preserve Thai Unicode characters correctly.

DRAFT:
[PASTE DRAFT HERE]

JSON SCHEMA:
${ARTICLE_SCHEMA_JSON}`;

// Basic HTML/script safety check for imported content
function containsUnsafeHtml(s: string): boolean {
  return /<\s*(script|iframe|object|embed|style|link|meta)\b/i.test(s) ||
    /\bon\w+\s*=/i.test(s) || /javascript:/i.test(s);
}

// ─── Word-form matching (for highlighting a vocab word in example sentences,
// even when it appears as an inflected or irregular form) ──────────────────────
// Common irregular verbs: base -> [past, past participle, and other forms].
const IRREGULAR_VERBS: Record<string, string[]> = {
  be: ["am","is","are","was","were","been","being"], become: ["became","become","becoming"],
  begin: ["began","begun","beginning"], break: ["broke","broken","breaking"], bring: ["brought","bringing"],
  build: ["built","building"], buy: ["bought","buying"], catch: ["caught","catching"], choose: ["chose","chosen","choosing"],
  come: ["came","come","coming"], cost: ["cost","costing"], cut: ["cut","cutting"], do: ["does","did","done","doing"],
  draw: ["drew","drawn","drawing"], drink: ["drank","drunk","drinking"], drive: ["drove","driven","driving"],
  eat: ["ate","eaten","eating"], fall: ["fell","fallen","falling"], feel: ["felt","feeling"], find: ["found","finding"],
  fly: ["flew","flown","flying"], forget: ["forgot","forgotten","forgetting"], get: ["got","gotten","getting"],
  give: ["gave","given","giving"], go: ["goes","went","gone","going"], grow: ["grew","grown","growing"],
  have: ["has","had","having"], hear: ["heard","hearing"], hide: ["hid","hidden","hiding"], hold: ["held","holding"],
  keep: ["kept","keeping"], know: ["knew","known","knowing"], lead: ["led","leading"], learn: ["learnt","learned","learning"],
  leave: ["left","leaving"], lose: ["lost","losing"], make: ["made","making"], mean: ["meant","meaning"],
  meet: ["met","meeting"], pay: ["paid","paying"], put: ["put","putting"], read: ["read","reading"],
  ride: ["rode","ridden","riding"], run: ["ran","run","running"], say: ["said","saying"], see: ["saw","seen","seeing"],
  sell: ["sold","selling"], send: ["sent","sending"], set: ["set","setting"], show: ["showed","shown","showing"],
  sing: ["sang","sung","singing"], sit: ["sat","sitting"], sleep: ["slept","sleeping"], speak: ["spoke","spoken","speaking"],
  spend: ["spent","spending"], stand: ["stood","standing"], swim: ["swam","swum","swimming"], take: ["took","taken","taking"],
  teach: ["taught","teaching"], tell: ["told","telling"], think: ["thought","thinking"], throw: ["threw","thrown","throwing"],
  understand: ["understood","understanding"], wear: ["wore","worn","wearing"], win: ["won","winning"], write: ["wrote","written","writing"],
};

// Generate likely regular inflections of a single word (lowercased).
function regularForms(w: string): string[] {
  const forms = new Set<string>([w]);
  // plural / 3rd person -s / -es / -ies
  if (/[^aeiou]y$/.test(w)) forms.add(w.slice(0, -1) + "ies");
  else if (/(s|sh|ch|x|z)$/.test(w)) forms.add(w + "es");
  else forms.add(w + "s");
  // -ed / -d / -ied / doubled consonant
  if (w.endsWith("e")) forms.add(w + "d");
  else if (/[^aeiou]y$/.test(w)) forms.add(w.slice(0, -1) + "ied");
  else forms.add(w + "ed");
  // -ing
  if (w.endsWith("e") && !w.endsWith("ee")) forms.add(w.slice(0, -1) + "ing");
  else forms.add(w + "ing");
  // simple doubled-consonant past/gerund for short CVC words (e.g. stop->stopped)
  if (/^[a-z]*[aeiou][bcdfghjklmnpqrstvwxz]$/.test(w) && w.length <= 5) {
    const d = w + w[w.length - 1];
    forms.add(d + "ed"); forms.add(d + "ing");
  }
  return [...forms];
}

// Build the set of forms to highlight for a vocab item: its own words, admin
// "forms" overrides, irregular-verb table, and automatic regular inflections.
function buildWordForms(headword: string, phrase: string, extra?: string[]): string[] {
  const set = new Set<string>();
  const base = (headword || phrase).toLowerCase().trim();
  const words = base.split(/\s+/);
  // Multi-word phrase: match the whole phrase and each significant word's forms
  if (words.length > 1) { set.add(base); }
  const primary = words[words.length - 1]; // last word usually carries inflection
  for (const w of [base, primary]) {
    if (!w) continue;
    regularForms(w).forEach(f => set.add(f));
    if (IRREGULAR_VERBS[w]) IRREGULAR_VERBS[w].forEach(f => set.add(f));
  }
  (extra ?? []).forEach(f => f && set.add(f.toLowerCase().trim()));
  // also the exact displayed phrase
  set.add(phrase.toLowerCase().trim());
  return [...set].filter(Boolean).sort((a, b) => b.length - a.length);
}

// Highlight the vocab word (any matched form) inside an example sentence,
// tinting it with a pastel version of its CEFR color.
function highlightWordInSentence(sentence: string, v: ArticleVocab): React.ReactNode {
  const forms = buildWordForms(v.headword, v.phrase, v.forms);
  if (!forms.length) return sentence;
  // word-boundary regex; escape special chars
  const esc = forms.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b(${esc.join("|")})\\b`, "gi");
  const color = CEFR_COLOR_MAP[v.cefr] ?? "#4A6163";
  const parts: React.ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  while ((m = re.exec(sentence)) !== null) {
    if (m.index > last) parts.push(sentence.slice(last, m.index));
    parts.push(
      <mark key={k++} className="vocab-hl" style={{ ["--hl" as string]: color }}>{m[0]}</mark>
    );
    last = m.index + m[0].length;
    if (re.lastIndex === m.index) re.lastIndex++; // avoid zero-length loop
  }
  if (last < sentence.length) parts.push(sentence.slice(last));
  return parts.length ? parts : sentence;
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
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
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
function VideoCard({ video, index, onClick, isAdmin, onEdit, onDelete, isFav, onFav, onGuestFav, epNumber, categoryLabel }: {
  video: Video; index: number; onClick: () => void;
  isAdmin?: boolean; onEdit?: () => void; onDelete?: () => void;
  isFav?: boolean; onFav?: () => void; onGuestFav?: () => void;
  epNumber: number; categoryLabel: string;
}) {
  const color = colorFor(video, index);
  const emoji = emojiFor(video, index);
  const data = getIdiomData(video);
  const cefrColor = data?.cefr ? ({ A1: "#27ae60", A2: "#2ecc71", B1: "#3498db", B2: "#a855f7", C1: "#e67e22", C2: "#e74c3c" }[data.cefr] ?? color) : color;

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
        <button className={`card-fav-btn ${isFav ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); onFav(); }} title={isFav ? "Remove from favorites" : "Add to favorites"} aria-label={isFav ? "Remove from favorites" : "Add to favorites"}>
          {isFav ? "❤️" : "🤍"}
        </button>
      )}
      {/* Guest favourite — prompts sign-in */}
      {!onFav && onGuestFav && (
        <button className="card-fav-btn" onClick={(e) => { e.stopPropagation(); onGuestFav(); }} title="Sign in to add favorites" aria-label="Sign in to add favorites">
          🤍
        </button>
      )}

      <div className="card-clickable" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onClick()}
        aria-label={`เปิดรายละเอียด: ${data?.idiom ?? video.title}`}>
        <div className="card-header">
          <div className="card-emoji" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>{emoji}</div>
          <div className="card-meta">
            <div className="card-episode">{categoryLabel}</div>
            <div className="card-episode">EP.{String(epNumber).padStart(3, "0")}</div>
            <div className="card-idiom-title">{data?.idiom ?? video.title} <button className="speak-btn-sm" onClick={(e) => { e.stopPropagation(); speakBilingual(data?.idiom ?? video.title); }} title="Listen">🔊</button></div>
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
              <div className="card-def-th">{data.definitionTH} <button className="speak-btn-sm" onClick={(e) => { e.stopPropagation(); speakThai(data.definitionTH); }} title="ฟังภาษาไทย">🔊</button></div>
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
        // Preserve any existing fields (category, article fields, etc.) that
        // this form does not edit, then override the edited ones.
        ...(data ?? {}),
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

// ─── Article Edit Modal (manual click-to-edit, like idioms) ────────────────────
function ArticleEditModal({ video, token, onClose, onSaved, onToast }: {
  video: Video | null; token: string; onClose: () => void; onSaved: () => void; onToast: (m: string, t: "success"|"error") => void;
}) {
  const existing = video ? (getIdiomData(video) as ArticleData | null) : null;
  const [title, setTitle] = useState(existing?.idiom ?? "");
  const [cefr, setCefr] = useState(existing?.cefr ?? "B2");
  const [articleCategory, setArticleCategory] = useState(existing?.articleCategory ?? "Technology & Society");
  const [author, setAuthor] = useState(existing?.author ?? "");
  const [source, setSource] = useState(existing?.source ?? "");
  const [readingTime, setReadingTime] = useState(existing?.readingTime ?? "");
  const [date, setDate] = useState(existing?.date ?? new Date().toISOString().split("T")[0]);
  const [thumbnail, setThumbnail] = useState(existing?.thumbnail ?? "📰");
  const [summaryEN, setSummaryEN] = useState(existing?.definitionEN ?? "");
  const [summaryTH, setSummaryTH] = useState(existing?.definitionTH ?? "");
  // Paragraphs joined with blank line between them for editing
  const [bodyEN, setBodyEN] = useState((existing?.bodyEN ?? []).join("\n\n"));
  const [bodyTH, setBodyTH] = useState((existing?.bodyTH ?? []).join("\n\n"));
  const [vocab, setVocab] = useState<ArticleVocab[]>(existing?.vocabulary ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);

  const addVocab = () => setVocab([...vocab, { phrase: "", headword: "", cefr: "B1", pos: "noun", meaningEN: "", meaningTH: "", exampleEN: "", exampleTH: "", pronunciation: "" }]);
  const removeVocab = (i: number) => setVocab(vocab.filter((_, j) => j !== i));
  const updateVocab = (i: number, field: keyof ArticleVocab, val: string) => {
    const copy = [...vocab];
    if (field === "forms") { copy[i] = { ...copy[i], forms: val.split(",").map(s => s.trim()).filter(Boolean) }; }
    else { copy[i] = { ...copy[i], [field]: val }; }
    setVocab(copy);
  };

  const handleSave = async () => {
    if (!title.trim() || !summaryEN.trim()) { onToast("Title and English summary are required.", "error"); return; }
    if (!VALID_CEFR.includes(cefr)) { onToast("Invalid CEFR level.", "error"); return; }
    const paraEN = bodyEN.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    const paraTH = bodyTH.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    const cleanVocab = vocab
      .filter(v => v.phrase.trim())
      .map(v => ({
        phrase: v.phrase.trim(),
        headword: (v.headword || v.phrase).trim(),
        cefr: VALID_CEFR.includes(v.cefr) ? v.cefr : "B1",
        pos: v.pos.trim(),
        meaningEN: v.meaningEN.trim(),
        meaningTH: v.meaningTH.trim(),
        exampleEN: v.exampleEN.trim(),
        exampleTH: v.exampleTH.trim(),
        pronunciation: v.pronunciation?.trim() || undefined,
        forms: (v.forms ?? []).map(f => f.trim()).filter(Boolean),
      }));
    setSaving(true);
    const data: ArticleData = {
      ...(existing ?? {} as ArticleData),
      isArticle: true,
      category: "articles",
      idiom: title.trim(),
      cefr,
      partOfSpeech: "article",
      articleCategory: articleCategory.trim(),
      author: author.trim() || undefined,
      source: source.trim() || undefined,
      readingTime: readingTime.trim() || undefined,
      date: date.trim() || undefined,
      thumbnail: thumbnail.trim() || "📰",
      definitionEN: summaryEN.trim(),
      definitionTH: summaryTH.trim(),
      bodyEN: paraEN,
      bodyTH: paraTH,
      vocabulary: cleanVocab,
      // Keep idiom-shape fields present so nothing else breaks
      synonyms: existing?.synonyms ?? [],
      antonyms: existing?.antonyms ?? [],
      keyWords: existing?.keyWords ?? [],
      examples: existing?.examples ?? [],
      usage: existing?.usage ?? "",
      context: existing?.context ?? "",
    };
    try {
      let res: Response;
      if (video) {
        res = await fetch("/api/idioms/edit", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ tiktokId: video.tiktok_id, data }) });
      } else {
        res = await fetch("/api/idioms/add", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(data) });
      }
      const result = await res.json();
      if (!res.ok) { onToast(`Save failed: ${result.error}`, "error"); return; }
      onToast(`✅ Article "${title}" saved!`, "success");
      onSaved(); onClose();
    } catch { onToast("Network error.", "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 720 }}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="modal-hero" style={{ padding: "24px 32px", background: "var(--off-white)" }}>
          <div className="modal-idiom-name" style={{ fontSize: 20 }}>📰 {video ? "Edit" : "New"} Article: {title || "Untitled"}</div>
        </div>
        <div className="modal-body" style={{ padding: "24px 32px", gap: 18, maxHeight: "72vh", overflowY: "auto" }}>

          <div className="edit-row">
            <div className="edit-field" style={{ flex: 3 }}>
              <label className="edit-label">Title *</label>
              <input className="edit-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="The Future of Work…" />
            </div>
            <div className="edit-field">
              <label className="edit-label">CEFR</label>
              <select className="edit-input" value={cefr} onChange={e => setCefr(e.target.value)}>
                {VALID_CEFR.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="edit-row">
            <div className="edit-field" style={{ flex: 2 }}>
              <label className="edit-label">Category</label>
              <input className="edit-input" value={articleCategory} onChange={e => setArticleCategory(e.target.value)} placeholder="Technology & Society" />
            </div>
            <div className="edit-field">
              <label className="edit-label">Reading time</label>
              <input className="edit-input" value={readingTime} onChange={e => setReadingTime(e.target.value)} placeholder="6 min" />
            </div>
            <div className="edit-field">
              <label className="edit-label">Emoji</label>
              <input className="edit-input" value={thumbnail} onChange={e => setThumbnail(e.target.value)} placeholder="📰" style={{ fontSize: 18, textAlign: "center" }} />
            </div>
          </div>

          <div className="edit-row">
            <div className="edit-field" style={{ flex: 2 }}>
              <label className="edit-label">✍️ Author / Writer</label>
              <input className="edit-input" value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author name" />
            </div>
            <div className="edit-field">
              <label className="edit-label">Date</label>
              <input className="edit-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <div className="edit-field">
            <label className="edit-label">📚 Reference / Source of data</label>
            <input className="edit-input" value={source} onChange={e => setSource(e.target.value)} placeholder="e.g. Original essay, journal name, URL, or 'Original content'" />
          </div>

          <div className="edit-field">
            <label className="edit-label">🇬🇧 Short summary (English) *</label>
            <textarea className="edit-input" rows={2} value={summaryEN} onChange={e => setSummaryEN(e.target.value)} placeholder="One-line summary shown on the card." />
          </div>
          <div className="edit-field">
            <label className="edit-label">🇹🇭 สรุปสั้น (ไทย)</label>
            <textarea className="edit-input" rows={2} value={summaryTH} onChange={e => setSummaryTH(e.target.value)} placeholder="สรุปสั้นๆ ที่แสดงบนการ์ด" />
          </div>

          <div className="edit-field">
            <label className="edit-label">🇬🇧 Full article — English (separate paragraphs with a blank line)</label>
            <textarea className="edit-input" rows={10} value={bodyEN} onChange={e => setBodyEN(e.target.value)} style={{ fontSize: 13, lineHeight: 1.6 }} placeholder={"First paragraph…\n\nSecond paragraph…"} />
          </div>
          <div className="edit-field">
            <label className="edit-label">🇹🇭 บทความเต็ม — ไทย (คั่นย่อหน้าด้วยบรรทัดว่าง)</label>
            <textarea className="edit-input" rows={10} value={bodyTH} onChange={e => setBodyTH(e.target.value)} style={{ fontSize: 13, lineHeight: 1.6 }} placeholder={"ย่อหน้าแรก…\n\nย่อหน้าที่สอง…"} />
          </div>

          {/* Vocabulary */}
          <div>
            <div className="edit-label" style={{ marginBottom: 8 }}>🔑 CEFR Vocabulary (exact phrases from the passage)</div>
            {vocab.map((v, i) => (
              <div key={i} className="edit-keyword-block">
                <div className="edit-row">
                  <div className="edit-field" style={{ flex: 2 }}><input className="edit-input" value={v.phrase} onChange={e => updateVocab(i, "phrase", e.target.value)} placeholder="Phrase in passage" /></div>
                  <div className="edit-field"><input className="edit-input" value={v.headword} onChange={e => updateVocab(i, "headword", e.target.value)} placeholder="Headword" /></div>
                  <div className="edit-field">
                    <select className="edit-input" value={v.cefr} onChange={e => updateVocab(i, "cefr", e.target.value)}>
                      {VALID_CEFR.map(l => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <button className="edit-remove-btn" onClick={() => removeVocab(i)} title="Remove">✕</button>
                </div>
                <input className="edit-input" value={v.pos} onChange={e => updateVocab(i, "pos", e.target.value)} placeholder="Part of speech" style={{ marginBottom: 4 }} />
                <input className="edit-input" value={v.meaningEN} onChange={e => updateVocab(i, "meaningEN", e.target.value)} placeholder="🇬🇧 English meaning" style={{ marginBottom: 4 }} />
                <input className="edit-input" value={v.meaningTH} onChange={e => updateVocab(i, "meaningTH", e.target.value)} placeholder="🇹🇭 ความหมายไทย" style={{ marginBottom: 4 }} />
                <input className="edit-input" value={v.exampleEN} onChange={e => updateVocab(i, "exampleEN", e.target.value)} placeholder="Example sentence (EN)" style={{ marginBottom: 4 }} />
                <input className="edit-input" value={v.exampleTH} onChange={e => updateVocab(i, "exampleTH", e.target.value)} placeholder="ตัวอย่างประโยค (ไทย)" style={{ marginBottom: 4 }} />
                <input className="edit-input" value={v.pronunciation ?? ""} onChange={e => updateVocab(i, "pronunciation", e.target.value)} placeholder="Pronunciation text (optional, if different)" style={{ marginBottom: 4 }} />
                <input className="edit-input" value={(v.forms ?? []).join(", ")} onChange={e => updateVocab(i, "forms", e.target.value)} placeholder="Extra forms to highlight, comma-separated (optional) — e.g. went, gone" />
              </div>
            ))}
            <button className="edit-add-btn" onClick={addVocab}>+ Add vocabulary</button>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="admin-login-btn" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spin">↻</span> Saving…</> : <>💾 Save Article</>}
            </button>
            <button className="admin-action-btn" style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }} onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Article Import Modal (validate → preview → confirm publish / save draft) ──
function ArticleImportModal({ token, existingIds, onClose, onSaved, onToast }: {
  token: string; existingIds: Set<string>; onClose: () => void; onSaved: () => void; onToast: (m: string, t: "success"|"error") => void;
}) {
  const [jsonText, setJsonText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<ArticleData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);

  const slugId = (title: string) => `article_${title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60)}`;

  const validate = (): { ok: boolean; data?: ArticleData; errs: string[] } => {
    const errs: string[] = [];
    let parsed: unknown;
    try { parsed = JSON.parse(jsonText); }
    catch (e) { return { ok: false, errs: [`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`] }; }
    if (!parsed || typeof parsed !== "object") return { ok: false, errs: ["Root must be a JSON object."] };
    const p = parsed as Record<string, unknown>;

    if (!p.idiom || typeof p.idiom !== "string" || !p.idiom.trim()) errs.push("Missing 'idiom' (article title).");
    if (!p.definitionEN || typeof p.definitionEN !== "string") errs.push("Missing 'definitionEN' (English summary).");
    if (!p.cefr || !VALID_CEFR.includes(p.cefr as string)) errs.push(`Invalid or missing 'cefr'. Must be one of ${VALID_CEFR.join(", ")}.`);
    if (!Array.isArray(p.bodyEN) || (p.bodyEN as unknown[]).length === 0) errs.push("Missing 'bodyEN' (must be a non-empty array of paragraphs).");
    if (p.bodyTH !== undefined && !Array.isArray(p.bodyTH)) errs.push("'bodyTH' must be an array of paragraphs.");
    if (Array.isArray(p.bodyEN) && Array.isArray(p.bodyTH) && (p.bodyEN as unknown[]).length !== (p.bodyTH as unknown[]).length) {
      errs.push(`bodyEN (${(p.bodyEN as unknown[]).length}) and bodyTH (${(p.bodyTH as unknown[]).length}) paragraph counts differ.`);
    }
    // Vocabulary validation
    const vocab = Array.isArray(p.vocabulary) ? (p.vocabulary as Record<string, unknown>[]) : [];
    const seenPhrases = new Set<string>();
    const bodyText = (Array.isArray(p.bodyEN) ? (p.bodyEN as string[]).join(" ") : "").toLowerCase();
    vocab.forEach((v, i) => {
      if (!v.phrase || typeof v.phrase !== "string") { errs.push(`Vocabulary #${i + 1}: missing 'phrase'.`); return; }
      if (v.cefr && !VALID_CEFR.includes(v.cefr as string)) errs.push(`Vocabulary #${i + 1} ('${v.phrase}'): invalid CEFR '${v.cefr}'.`);
      const key = (v.phrase as string).toLowerCase();
      if (seenPhrases.has(key)) errs.push(`Duplicate vocabulary phrase: '${v.phrase}'.`);
      seenPhrases.add(key);
      if (bodyText && !bodyText.includes(key)) errs.push(`Vocabulary '${v.phrase}' does not appear in bodyEN.`);
    });
    // HTML/script safety across all text fields
    const allText = JSON.stringify(p);
    if (containsUnsafeHtml(allText)) errs.push("Content contains unsafe HTML/script. Remove <script>, event handlers, or javascript: URLs.");
    // Duplicate article id
    if (typeof p.idiom === "string") {
      const id = slugId(p.idiom);
      if (existingIds.has(id)) errs.push(`An article with a matching ID already exists ('${id}'). Change the title or edit the existing article.`);
    }

    if (errs.length) return { ok: false, errs };

    const data: ArticleData = {
      isArticle: true,
      category: "articles",
      idiom: (p.idiom as string).trim(),
      cefr: p.cefr as string,
      partOfSpeech: "article",
      articleCategory: (p.articleCategory as string) || "Article",
      author: (p.author as string) || undefined,
      source: (p.source as string) || undefined,
      readingTime: (p.readingTime as string) || undefined,
      date: (p.date as string) || new Date().toISOString().split("T")[0],
      thumbnail: (p.thumbnail as string) || "📰",
      definitionEN: (p.definitionEN as string).trim(),
      definitionTH: (p.definitionTH as string) || "",
      bodyEN: (p.bodyEN as string[]).map(s => String(s).trim()).filter(Boolean),
      bodyTH: Array.isArray(p.bodyTH) ? (p.bodyTH as string[]).map(s => String(s).trim()).filter(Boolean) : [],
      vocabulary: vocab.map(v => ({
        phrase: String(v.phrase).trim(),
        headword: String(v.headword || v.phrase).trim(),
        cefr: (v.cefr as string) && VALID_CEFR.includes(v.cefr as string) ? (v.cefr as string) : "B1",
        pos: String(v.pos || "").trim(),
        meaningEN: String(v.meaningEN || "").trim(),
        meaningTH: String(v.meaningTH || "").trim(),
        exampleEN: String(v.exampleEN || "").trim(),
        exampleTH: String(v.exampleTH || "").trim(),
        pronunciation: v.pronunciation ? String(v.pronunciation).trim() : undefined,
        forms: Array.isArray(v.forms) ? (v.forms as string[]).map(f => String(f).trim()).filter(Boolean) : undefined,
      })),
      synonyms: [], antonyms: [], keyWords: [], examples: [],
      usage: "", context: "",
    };
    return { ok: true, data, errs: [] };
  };

  const doValidate = () => {
    const r = validate();
    setErrors(r.errs);
    setPreview(r.ok ? r.data! : null);
  };

  const doSave = async (asDraft: boolean) => {
    const r = validate();
    if (!r.ok || !r.data) { setErrors(r.errs); setPreview(null); return; }
    setSaving(true);
    const payload: ArticleData & { draft?: boolean } = { ...r.data };
    if (asDraft) payload.draft = true;
    try {
      const res = await fetch("/api/idioms/add", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (!res.ok) { setErrors([result.error || "Save failed."]); return; }
      onToast(asDraft ? `📝 Draft saved: "${r.data.idiom}"` : `✅ Article published: "${r.data.idiom}"`, "success");
      onSaved(); onClose();
    } catch { setErrors(["Network error."]); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 720 }}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="modal-hero" style={{ padding: "24px 32px", background: "var(--off-white)" }}>
          <div className="modal-idiom-name" style={{ fontSize: 20 }}>📥 Import Article JSON</div>
        </div>
        <div className="modal-body" style={{ padding: "24px 32px", gap: 16, maxHeight: "72vh", overflowY: "auto" }}>
          <p className="admin-hint">Paste JSON generated from the AI prompt. It will be validated before publishing. Nothing is saved until you confirm.</p>
          <div className="admin-field">
            <textarea className="admin-input" style={{ minHeight: 260, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.5, resize: "vertical" }}
              value={jsonText} onChange={e => { setJsonText(e.target.value); setErrors([]); setPreview(null); }} placeholder="Paste article JSON here…" />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="admin-action-btn" onClick={doValidate} disabled={!jsonText.trim()}>🔍 Validate &amp; Preview</button>
          </div>

          {errors.length > 0 && (
            <div className="admin-result err" style={{ whiteSpace: "pre-line" }}>
              <strong>Cannot import — fix these:</strong>{"\n"}{errors.map(e => `• ${e}`).join("\n")}
            </div>
          )}

          {preview && (
            <div className="article-import-preview">
              <div className="admin-section-label">✅ Preview</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <span className="article-category-badge">{preview.articleCategory}</span>
                <span className={`tag tag-cefr ${preview.cefr}`}>{preview.cefr}</span>
                {preview.readingTime && <span className="article-meta-text">⏱ {preview.readingTime}</span>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "var(--slate)", marginBottom: 4 }}>{preview.idiom}</div>
              <div className="article-byline" style={{ marginBottom: 8 }}>
                {preview.author && <span>✍️ {preview.author}</span>}
                {preview.source && <span className="article-source">📚 {preview.source}</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>🇬🇧 {preview.definitionEN}</div>
              {preview.definitionTH && <div style={{ fontSize: 13, color: "var(--slate)", marginBottom: 6, fontFamily: "'Kanit', sans-serif" }}>🇹🇭 {preview.definitionTH}</div>}
              <div className="admin-hint">{preview.bodyEN.length} EN paragraph(s) · {preview.bodyTH.length} TH paragraph(s) · {preview.vocabulary.length} vocabulary item(s)</div>
              {preview.vocabulary.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {preview.vocabulary.map((v, i) => <span key={i} className={`tag tag-cefr ${v.cefr}`} style={{ fontSize: 10 }}>{v.phrase}</span>)}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button className="admin-login-btn" style={{ flex: 1 }} onClick={() => doSave(false)} disabled={saving}>
                  {saving ? <><span className="spin">↻</span> Publishing…</> : <>🚀 Confirm &amp; Publish</>}
                </button>
                <button className="admin-action-btn" onClick={() => doSave(true)} disabled={saving}>📝 Save as draft</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Article Modal ────────────────────────────────────────────────────────────
// Renders a full bilingual article with per-paragraph highlight during playback,
// playback controls (play/pause/resume/restart/stop), and inline CEFR vocabulary
// annotations that open full details and can be saved to the flashcard deck.
function renderAnnotatedParagraph(
  paragraph: string,
  vocab: ArticleVocab[],
  onOpenVocab: (v: ArticleVocab, rect: DOMRect) => void
) {
  if (!vocab.length) return <>{paragraph}</>;
  const phrases = [...vocab].sort((a, b) => b.phrase.length - a.phrase.length);
  const nodes: React.ReactNode[] = [];
  let remaining = paragraph;
  let key = 0;
  while (remaining.length > 0) {
    let matchIdx = -1;
    let matched: ArticleVocab | null = null;
    for (const v of phrases) {
      if (!v.phrase) continue;
      const idx = remaining.toLowerCase().indexOf(v.phrase.toLowerCase());
      if (idx !== -1 && (matchIdx === -1 || idx < matchIdx)) { matchIdx = idx; matched = v; }
    }
    if (matchIdx === -1 || !matched) { nodes.push(<span key={key++}>{remaining}</span>); break; }
    if (matchIdx > 0) nodes.push(<span key={key++}>{remaining.slice(0, matchIdx)}</span>);
    const actual = remaining.slice(matchIdx, matchIdx + matched.phrase.length);
    const v = matched;
    const openFromEl = (el: HTMLElement) => onOpenVocab(v, el.getBoundingClientRect());
    // The short meaning label above the word is absolutely positioned so it is
    // removed from the text flow and never stretches the line / scatters words.
    nodes.push(
      <span key={key++} className="vocab-annot" tabIndex={0} role="button"
        style={{ ["--vc-color" as string]: CEFR_COLOR_MAP[v.cefr] ?? "var(--slate)" }}
        aria-label={`${v.phrase}, CEFR ${v.cefr}. ${v.meaningEN}. Open details`}
        onClick={(e) => { e.stopPropagation(); openFromEl(e.currentTarget); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFromEl(e.currentTarget); } }}
      >
        <span className="vocab-annot-label" aria-hidden="true">{v.meaningTH || v.meaningEN}</span>
        <span className="vocab-annot-word">{actual}</span>
      </span>
    );
    remaining = remaining.slice(matchIdx + matched.phrase.length);
  }
  return <>{nodes}</>;
}

function ArticleModal({ video, epNumber, onClose, isAdmin, onEdit, savedWordIds, onSaveWord }: {
  video: Video; epNumber: number; onClose: () => void;
  isAdmin?: boolean; onEdit?: () => void;
  savedWordIds?: Set<string>;
  onSaveWord?: (wordId: string, wordData: Record<string, unknown>) => void;
}) {
  const data = getIdiomData(video) as ArticleData | null;
  const cefrColor = data?.cefr ? (CEFR_COLOR_MAP[data.cefr] ?? "var(--slate)") : "var(--slate)";
  const [lang, setLang] = useState<"en" | "th">("en");
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activePara, setActivePara] = useState(-1);
  const [wordRange, setWordRange] = useState<{ start: number; end: number } | null>(null);
  const [selectedVocab, setSelectedVocab] = useState<{ v: ArticleVocab; rect: DOMRect } | null>(null);
  const openVocab = (v: ArticleVocab, rect: DOMRect) => setSelectedVocab({ v, rect });
  const stoppedRef = useRef(false);

  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); onClose(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  useEffect(() => () => { if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); }, []);

  const paragraphs = lang === "en" ? (data?.bodyEN ?? []) : (data?.bodyTH ?? []);

  const startPlayback = (fromStart = true) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synthLang = lang === "th" ? "th-TH" : "en-US";
    const voice = getVoice(lang);
    if (lang === "th" && !voice) {
      alert("No Thai voice is available on this device/browser. Please install a Thai system voice to hear the Thai passage.");
      return;
    }
    window.speechSynthesis.cancel();
    stoppedRef.current = false;
    setPlaying(true); setPaused(false); setWordRange(null);
    let idx = fromStart ? 0 : Math.max(0, activePara);
    const speakPara = () => {
      if (stoppedRef.current || idx >= paragraphs.length) { setPlaying(false); setActivePara(-1); setWordRange(null); return; }
      setActivePara(idx); setWordRange(null);
      const text = paragraphs[idx];
      const u = new SpeechSynthesisUtterance(text);
      u.lang = synthLang;
      u.rate = lang === "th" ? 0.9 : 0.86;
      u.pitch = lang === "th" ? 1.0 : 1.03;
      if (voice) u.voice = voice;
      // Word-by-word highlight: onboundary reports the char index of each word.
      u.onboundary = (ev: SpeechSynthesisEvent) => {
        if (stoppedRef.current) return;
        if (ev.name && ev.name !== "word") return;
        const start = ev.charIndex ?? 0;
        // Derive word end: use charLength if provided, else scan to next space.
        let end = start + (ev.charLength ?? 0);
        if (!ev.charLength) { const nextSpace = text.slice(start).search(/\s|$/); end = start + (nextSpace === -1 ? text.length - start : nextSpace); }
        setWordRange({ start, end });
      };
      u.onend = () => { setWordRange(null); idx++; if (!stoppedRef.current) speakPara(); };
      window.speechSynthesis.speak(u);
    };
    speakPara();
  };

  const pausePlayback = () => { if (window.speechSynthesis) { window.speechSynthesis.pause(); setPaused(true); } };
  const resumePlayback = () => { if (window.speechSynthesis) { window.speechSynthesis.resume(); setPaused(false); } };
  const stopPlayback = () => { stoppedRef.current = true; if (window.speechSynthesis) window.speechSynthesis.cancel(); setPlaying(false); setPaused(false); setActivePara(-1); setWordRange(null); };
  const restartPlayback = () => { stopPlayback(); setTimeout(() => startPlayback(true), 60); };
  const switchLang = (l: "en" | "th") => { stopPlayback(); setLang(l); };

  if (!data) return null;

  const vocabId = (v: ArticleVocab) => `word_${(v.headword || v.phrase).toLowerCase().replace(/\s+/g, "_")}`;

  return (
    <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) { stopPlayback(); onClose(); } }} role="dialog" aria-modal="true">
      <div className="modal article-modal">
        <button className="modal-close" onClick={() => { stopPlayback(); onClose(); }} aria-label="Close">✕</button>

        <div className="article-hero">
          <div className="article-meta-row">
            <span className="article-category-badge">{data.articleCategory || "Article"}</span>
            <span className={`tag tag-cefr ${data.cefr}`}>{data.cefr}</span>
            <span className="article-meta-sep">·</span>
            <span className="article-meta-text">{fmtDate(video.published_at)}</span>
            {data.readingTime && <><span className="article-meta-sep">·</span><span className="article-meta-text">⏱ {data.readingTime}</span></>}
            <span className="article-meta-text">EP.{String(epNumber).padStart(3, "0")}</span>
          </div>
          <h1 className="article-title" style={{ ["--vc-color" as string]: cefrColor }}>
            {data.idiom} <button className="speak-btn" onClick={() => speakBilingual(data.idiom)} title="Listen" aria-label="Listen to title">🔊</button>
          </h1>
          <div className="article-byline">
            {data.author && <span>✍️ {data.author}</span>}
            {data.source && <span className="article-source">📚 Source: {data.source}</span>}
          </div>
          {isAdmin && onEdit && (
            <button className="edit-add-btn" style={{ marginTop: 10 }} onClick={onEdit}>✏️ Edit article</button>
          )}
        </div>

        <div className="modal-body article-body">
          <div className="article-controls">
            <div className="article-lang-toggle">
              <button className={`filter-btn ${lang === "en" ? "active" : ""}`} onClick={() => switchLang("en")}>🇬🇧 English</button>
              <button className={`filter-btn ${lang === "th" ? "active" : ""}`} onClick={() => switchLang("th")}>🇹🇭 ภาษาไทย</button>
            </div>
            <div className="article-playback">
              {!playing && <button className="article-play-btn" onClick={() => startPlayback(true)}>▶ {lang === "en" ? "Listen in English" : "ฟังภาษาไทย"}</button>}
              {playing && !paused && <button className="article-play-btn" onClick={pausePlayback}>⏸ Pause</button>}
              {playing && paused && <button className="article-play-btn" onClick={resumePlayback}>▶ Resume</button>}
              {playing && <button className="article-ctrl-btn" onClick={restartPlayback} title="Restart">⟲</button>}
              {playing && <button className="article-ctrl-btn" onClick={stopPlayback} title="Stop">⏹</button>}
            </div>
          </div>

          <article className="article-passage">
            {paragraphs.map((p, i) => {
              const isReading = activePara === i;
              let content: React.ReactNode;
              if (isReading && wordRange) {
                // While being read, highlight the current word (word-by-word).
                const { start, end } = wordRange;
                const s = Math.max(0, Math.min(start, p.length));
                const e = Math.max(s, Math.min(end, p.length));
                content = <>{p.slice(0, s)}<mark className="reading-word">{p.slice(s, e)}</mark>{p.slice(e)}</>;
              } else if (lang === "en") {
                content = renderAnnotatedParagraph(p, data.vocabulary ?? [], openVocab);
              } else {
                content = p;
              }
              return (
                <p key={i} className={`article-para ${isReading ? "reading" : ""}`}>{content}</p>
              );
            })}
            {paragraphs.length === 0 && <p className="article-para" style={{ color: "var(--text-muted)" }}>No {lang === "en" ? "English" : "Thai"} content available.</p>}
          </article>

          {(data.vocabulary?.length ?? 0) > 0 && (
            <div className="modal-section">
              <div className="section-label"><span className="icon">🔑</span>CEFR Vocabulary</div>
              <div className="keywords-grid">
                {data.vocabulary.map((v, i) => {
                  const wid = vocabId(v);
                  const saved = savedWordIds?.has(wid);
                  return (
                    <div key={i} className="keyword-card" style={{ borderLeft: `3px solid ${CEFR_COLOR_MAP[v.cefr] ?? "var(--slate)"}` }}>
                      <div className="keyword-header">
                        <div className="keyword-word">{v.phrase} <button className="speak-btn" onClick={() => speakWord(v.pronunciation || v.phrase)} title="Listen" aria-label="Listen to pronunciation">🔊</button></div>
                        <div className="keyword-badges">
                          <span className={`tag tag-cefr ${v.cefr}`}>{v.cefr}</span>
                          <span className="tag tag-pos">{v.pos}</span>
                          {onSaveWord && (
                            <button className={`word-save-btn ${saved ? "saved" : ""}`}
                              onClick={() => !saved && onSaveWord(wid, { word: v.headword || v.phrase, cefr: v.cefr, pos: v.pos, definitionEN: v.meaningEN, definitionTH: v.meaningTH, example: v.exampleEN })}
                              title={saved ? "Already in deck" : "Save to flashcard deck"} aria-label={saved ? "Already in deck" : "Save to flashcard deck"}>
                              {saved ? "✅" : "➕"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="keyword-def-en">🇬🇧 {v.meaningEN}</div>
                      <div className="keyword-def-th">🇹🇭 {v.meaningTH} <button className="speak-btn-sm" onClick={() => speakThai(v.meaningTH)} title="ฟังภาษาไทย">🔊</button></div>
                      {v.exampleEN && <div className="article-vocab-ex">“{highlightWordInSentence(v.exampleEN, v)}” <button className="speak-btn-sm" onClick={() => speakWord(v.exampleEN)} title="Listen">🔊</button></div>}
                      {v.exampleTH && <div className="article-vocab-ex th">“{v.exampleTH}” <button className="speak-btn-sm" onClick={() => speakThai(v.exampleTH)} title="ฟังภาษาไทย">🔊</button></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {selectedVocab && (() => {
          const sv = selectedVocab.v;
          return (
            <div className="vocab-popover-overlay centered" onClick={() => setSelectedVocab(null)}>
              <div className="vocab-popover" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
                style={{ borderTop: `3px solid ${CEFR_COLOR_MAP[sv.cefr] ?? "var(--slate)"}` }}>
                <button className="modal-close" style={{ top: 10, right: 10, width: 30, height: 30 }} onClick={() => setSelectedVocab(null)} aria-label="Close">✕</button>
                <div className="keyword-word" style={{ fontSize: 20 }}>{sv.phrase} <button className="speak-btn" onClick={() => speakWord(sv.pronunciation || sv.phrase)} title="Listen" aria-label="Listen to pronunciation">🔊</button></div>
                <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
                  <span className={`tag tag-cefr ${sv.cefr}`}>{sv.cefr}</span>
                  <span className="tag tag-pos">{sv.pos}</span>
                </div>
                <div className="keyword-def-en">🇬🇧 {sv.meaningEN}</div>
                <div className="keyword-def-th">🇹🇭 {sv.meaningTH} <button className="speak-btn-sm" onClick={() => speakThai(sv.meaningTH)} title="ฟังภาษาไทย">🔊</button></div>
                {sv.exampleEN && <div className="article-vocab-ex">“{highlightWordInSentence(sv.exampleEN, sv)}” <button className="speak-btn-sm" onClick={() => speakWord(sv.exampleEN)} title="Listen">🔊</button></div>}
                {sv.exampleTH && <div className="article-vocab-ex th">“{sv.exampleTH}” <button className="speak-btn-sm" onClick={() => speakThai(sv.exampleTH)} title="ฟังภาษาไทย">🔊</button></div>}
                {onSaveWord && (() => {
                  const wid = vocabId(sv); const saved = savedWordIds?.has(wid);
                  return <button className="admin-login-btn" style={{ marginTop: 12 }} disabled={saved}
                    onClick={() => { if (!saved) onSaveWord(wid, { word: sv.headword || sv.phrase, cefr: sv.cefr, pos: sv.pos, definitionEN: sv.meaningEN, definitionTH: sv.meaningTH, example: sv.exampleEN }); }}>
                    {saved ? "✅ In your deck" : "➕ Add to flashcards"}
                  </button>;
                })()}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Rich Detail Modal ────────────────────────────────────────────────────────
function DetailModal({ video, index, epNumber, onClose, userSession, savedWordIds, onSaveWord }: { video: Video; index: number; epNumber: number; onClose: () => void; userSession?: { id: string } | null; savedWordIds?: Set<string>; onSaveWord?: (wordId: string, wordData: Record<string, unknown>) => void }) {
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
        <div className="modal-hero">
          <div className="modal-episode-row">
            <span className="modal-episode">EP.{String(epNumber).padStart(3, "0")}</span>
            <span style={{ color: "var(--border)" }}>·</span>
            <span className="modal-date">{fmtDate(video.published_at)}</span>
          </div>
          <div className="modal-emoji-title">
            <div className="modal-emoji" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>{emoji}</div>
            <div className="modal-title-wrap">
              <div className="modal-idiom-name">
                {data?.idiom ?? video.title} <button className="speak-btn" onClick={(e) => { e.stopPropagation(); speakBilingual(data?.idiom ?? video.title); }} title="Listen">🔊</button>
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
                <div className="def-box en"><div className="def-lang">🇬🇧 English</div><div className="def-text">{data.definitionEN} <button className="speak-btn-sm" onClick={() => speakWord(data.definitionEN)} title="Listen">🔊</button></div></div>
                <div className="def-box th"><div className="def-lang">🇹🇭 ภาษาไทย</div><div className="def-text">{data.definitionTH} <button className="speak-btn-sm" onClick={() => speakThai(data.definitionTH)} title="ฟังภาษาไทย">🔊</button></div></div>
              </div>

              {/* Synonyms & Antonyms */}
              <div className="modal-section">
                <div className="section-label"><span className="icon">🔄</span>Synonyms &amp; Antonyms</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10, fontWeight: 600 }}>✅ Synonyms (คำพ้องความหมาย)</div>
                  <div className="word-chips">{data.synonyms.map((s, i) => {
                    const rw = toRichWord(s);
                    const sId = `word_${rw.word.toLowerCase().replace(/\s+/g, "_")}`;
                    const sSaved = savedWordIds?.has(sId);
                    return <span key={i} className={`chip chip-syn chip-rich ${onSaveWord ? "clickable" : ""} ${sSaved ? "saved" : ""}`}
                      onClick={() => onSaveWord && !sSaved && onSaveWord(sId, { word: rw.word, cefr: data.cefr, pos: rw.pos || data.partOfSpeech, definitionEN: rw.meaningEN || `Means the same as "${data.idiom}" — ${data.definitionEN}`, definitionTH: rw.meaningTH || data.definitionTH, example: rw.example })}
                    ><span className="chip-word">{rw.word}<button className="speak-btn-sm" onClick={(e) => { e.stopPropagation(); speakWord(rw.word); }} title="Listen">🔊</button>{onSaveWord && !sSaved && " +"}</span>{rw.meaningTH && <span className="chip-th" onClick={(e) => { e.stopPropagation(); speakThai(rw.meaningTH); }} title="ฟังภาษาไทย" style={{ cursor: "pointer" }}>{rw.meaningTH} 🔊</span>}</span>;
                  })}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10, fontWeight: 600 }}>❌ Antonyms (คำตรงข้าม)</div>
                  <div className="word-chips">{data.antonyms.map((a, i) => {
                    const rw = toRichWord(a);
                    const aId = `word_${rw.word.toLowerCase().replace(/\s+/g, "_")}`;
                    const aSaved = savedWordIds?.has(aId);
                    return <span key={i} className={`chip chip-ant chip-rich ${onSaveWord ? "clickable" : ""} ${aSaved ? "saved" : ""}`}
                      onClick={() => onSaveWord && !aSaved && onSaveWord(aId, { word: rw.word, cefr: data.cefr, pos: rw.pos || data.partOfSpeech, definitionEN: rw.meaningEN || `Opposite of "${data.idiom}" — means NOT ${data.definitionEN.toLowerCase()}`, definitionTH: rw.meaningTH || `ตรงข้ามกับ "${data.idiom}" — ${data.definitionTH}`, example: rw.example })}
                    ><span className="chip-word">{rw.word}<button className="speak-btn-sm" onClick={(e) => { e.stopPropagation(); speakWord(rw.word); }} title="Listen">🔊</button>{onSaveWord && !aSaved && " +"}</span>{rw.meaningTH && <span className="chip-th" onClick={(e) => { e.stopPropagation(); speakThai(rw.meaningTH); }} title="ฟังภาษาไทย" style={{ cursor: "pointer" }}>{rw.meaningTH} 🔊</span>}</span>;
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
                          <div className="keyword-word">{kw.word} <button className="speak-btn" onClick={(e) => { e.stopPropagation(); speakWord(kw.word); }} title="Listen">🔊</button></div>
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
                        <div className="keyword-def-en">🇬🇧 {kw.definitionEN} <button className="speak-btn-sm" onClick={(e) => { e.stopPropagation(); speakWord(kw.definitionEN); }} title="Listen">🔊</button></div>
                        <div className="keyword-def-th">🇹🇭 {kw.definitionTH} <button className="speak-btn-sm" onClick={(e) => { e.stopPropagation(); speakThai(kw.definitionTH); }} title="ฟังภาษาไทย">🔊</button></div>
                        {kw.synonyms.length > 0 && (
                          <div className="keyword-syn-row">
                            <div className="keyword-syn-label">Synonyms</div>
                            <div className="mini-chips">{kw.synonyms.map((s, j) => {
                              const rw = toRichWord(s);
                              const sId = `word_${rw.word.toLowerCase().replace(/\s+/g, "_")}`;
                              const sSaved = savedWordIds?.has(sId);
                              return <span key={j} className={`mini-chip mini-chip-syn chip-rich ${onSaveWord ? "clickable" : ""} ${sSaved ? "saved" : ""}`}
                                onClick={() => onSaveWord && !sSaved && onSaveWord(sId, { word: rw.word, cefr: kw.cefr, pos: rw.pos || kw.pos, definitionEN: rw.meaningEN || `Means the same as "${kw.word}" — ${kw.definitionEN}`, definitionTH: rw.meaningTH || kw.definitionTH, example: rw.example })}
                              ><span className="chip-word">{rw.word}<button className="speak-btn-sm" onClick={(e) => { e.stopPropagation(); speakWord(rw.word); }} title="Listen">🔊</button>{onSaveWord && !sSaved && " +"}</span>{rw.meaningTH && <span className="chip-th" onClick={(e) => { e.stopPropagation(); speakThai(rw.meaningTH); }} title="ฟังภาษาไทย" style={{ cursor: "pointer" }}>{rw.meaningTH} 🔊</span>}</span>;
                            })}</div>
                          </div>
                        )}
                        {kw.antonyms.length > 0 && (
                          <div className="keyword-ant-row">
                            <div className="keyword-ant-label">Antonyms</div>
                            <div className="mini-chips">{kw.antonyms.map((a, j) => {
                              const rw = toRichWord(a);
                              const aId = `word_${rw.word.toLowerCase().replace(/\s+/g, "_")}`;
                              const aSaved = savedWordIds?.has(aId);
                              return <span key={j} className={`mini-chip mini-chip-ant chip-rich ${onSaveWord ? "clickable" : ""} ${aSaved ? "saved" : ""}`}
                                onClick={() => onSaveWord && !aSaved && onSaveWord(aId, { word: rw.word, cefr: kw.cefr, pos: rw.pos || kw.pos, definitionEN: rw.meaningEN || `Opposite of "${kw.word}" — means NOT ${kw.definitionEN.toLowerCase()}`, definitionTH: rw.meaningTH || `ตรงข้ามกับ "${kw.word}" — ${kw.definitionTH}`, example: rw.example })}
                              ><span className="chip-word">{rw.word}<button className="speak-btn-sm" onClick={(e) => { e.stopPropagation(); speakWord(rw.word); }} title="Listen">🔊</button>{onSaveWord && !aSaved && " +"}</span>{rw.meaningTH && <span className="chip-th" onClick={(e) => { e.stopPropagation(); speakThai(rw.meaningTH); }} title="ฟังภาษาไทย" style={{ cursor: "pointer" }}>{rw.meaningTH} 🔊</span>}</span>;
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
                          <div className="example-en"><span dangerouslySetInnerHTML={{ __html: `"${highlighted}"` }} /> <button className="speak-btn-sm" onClick={() => speakWord(ex.en)} title="Listen">🔊</button></div>
                          <div className="example-th">{ex.th} <button className="speak-btn-sm" onClick={() => speakThai(ex.th)} title="ฟังภาษาไทย">🔊</button></div>
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
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "var(--off-white)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--slate)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
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
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, padding: "10px 18px", background: "var(--off-white)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--slate)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
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
  onAuth: (token: string, role: "admin"|"user"|"", displayName?: string) => void;
  onUpdateName?: (name: string) => void;
  userSession: { id: string; email: string; displayName: string; role: "admin"|"user" } | null;
  adminToken: string;
  videos: Video[];
  favourites: Set<string>;
  savedWords: Array<{ id: string; data: Record<string, unknown> }>;
  onToggleFav: (tiktokId: string) => void;
  onRemoveWord: (wordId: string) => void;
  addCategory: string;
  initialTab?: "login"|"register";
}

function SidePanel({ open, onClose, onToast, onRefresh, onAuth, onUpdateName, userSession, adminToken, videos, favourites, savedWords, onToggleFav, onRemoveWord, addCategory, initialTab }: SidePanelProps) {
  const [tab, setTab] = useState<"login"|"register"|"admin"|"deck"|"users"|"stats"|"settings">("login");
  // Sync tab from parent when header buttons trigger open
  useEffect(() => { if (initialTab && !userSession) setTab(initialTab); }, [initialTab, open, userSession]);
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
  // Settings
  const [settingsName, setSettingsName] = useState("");
  const [settingsCurPass, setSettingsCurPass] = useState("");
  const [settingsNewPass, setSettingsNewPass] = useState("");
  const [settingsConfirmPass, setSettingsConfirmPass] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsResult, setSettingsResult] = useState<string|null>(null);
  // Pre-fill display name when user session is available or tab changes to settings
  useEffect(() => { if (userSession && tab === "settings") setSettingsName(userSession.displayName || ""); }, [tab, userSession]);
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
        onClose();
        return;
      }
      // Try user login
      const res = await fetch("/api/users/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: loginEmail, password: loginPass }) });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error); return; }
      onAuth(data.token, "user", data.user?.displayName);
      setLoginEmail(""); setLoginPass("");
      onClose();
    } catch { setLoginError("Network error."); }
    finally { setLoginLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setRegLoading(true); setRegResult(null);
    try {
      const res = await fetch("/api/users/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: regEmail, password: regPass, displayName: regName, fullName: regName, age: parseInt(regAge) || 0, phone: regPhone }) });
      const data = await res.json();
      if (!res.ok) { setRegResult(`❌ ${data.error}`); return; }
      setRegResult(`✅ Registration successful!\nPlease wait for admin to grant access, then sign in again.\n\nลงทะเบียนสำเร็จ!\nกรุณารอให้ admin อนุมัติสิทธิ์การเข้าใช้งาน แล้วลงชื่อเข้าใช้อีกครั้ง`);
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

  const sampleJson = addCategory === "howtosay" ? `{
  "idiom": "How to say 'I disagree' politely",
  "cefr": "B1",
  "partOfSpeech": "phrase",
  "category": "howtosay",
  "date": "${new Date().toISOString().split("T")[0]}",
  "thumbnail": "🗣️",
  "color": "#4ECDC4",
  "tiktokUrl": "",
  "definitionEN": "Polite ways to express disagreement in English.",
  "definitionTH": "วิธีพูดไม่เห็นด้วยอย่างสุภาพในภาษาอังกฤษ",
  "synonyms": [{"word":"I see it differently","meaningTH":"ฉันมองต่างออกไป","pos":"phrase","example":"I see it differently — here's why."},{"word":"I'm not sure about that","meaningTH":"ฉันไม่ค่อยแน่ใจนะ","pos":"phrase","example":"I'm not sure about that approach."},{"word":"I respectfully disagree","meaningTH":"ฉันไม่เห็นด้วยด้วยความเคารพ","pos":"phrase","example":"I respectfully disagree with your conclusion."}],
  "antonyms": [{"word":"I totally agree","meaningTH":"เห็นด้วยอย่างยิ่ง","pos":"phrase","example":"I totally agree with you."},{"word":"Absolutely","meaningTH":"แน่นอน","pos":"adverb","example":"Absolutely, that's a great idea."}],
  "keyWords": [{"word":"disagree","cefr":"A2","pos":"verb","definitionEN":"To have a different opinion","definitionTH":"ไม่เห็นด้วย","synonyms":[{"word":"differ","meaningTH":"แตกต่าง"},{"word":"oppose","meaningTH":"คัดค้าน"}],"antonyms":[{"word":"agree","meaningTH":"เห็นด้วย"}]}],
  "examples": [
    {"en":"I see your point, but I respectfully disagree.","th":"ฉันเข้าใจมุมของคุณ แต่ฉันไม่เห็นด้วยค่ะ"},
    {"en":"I'm not sure I agree with that approach.","th":"ฉันไม่แน่ใจว่าเห็นด้วยกับวิธีนั้น"},
    {"en":"That's an interesting idea, but I have a different view.","th":"นั่นเป็นไอเดียที่น่าสนใจ แต่ฉันมีมุมมองที่แตกต่าง"}
  ],
  "usage": "Formal & Semi-formal",
  "context": "Work, meetings, discussions"
}` : addCategory === "motto" ? `{
  "idiom": "No pain, no gain",
  "cefr": "A2",
  "partOfSpeech": "proverb",
  "category": "motto",
  "date": "${new Date().toISOString().split("T")[0]}",
  "thumbnail": "💪",
  "color": "#FFE66D",
  "tiktokUrl": "",
  "definitionEN": "You have to work hard and suffer to achieve something worthwhile.",
  "definitionTH": "ไม่มีความเจ็บปวด ก็ไม่มีความสำเร็จ — ต้องอดทนทำงานหนักถึงจะได้ผลลัพธ์ที่ดี",
  "synonyms": [{"word":"no cross, no crown","meaningTH":"ไม่มีไม้กางเขน ก็ไม่มีมงกุฎ","pos":"proverb","example":"He kept going despite the pain — no cross, no crown."},{"word":"nothing ventured, nothing gained","meaningTH":"ไม่เสี่ยง ก็ไม่ได้อะไร","pos":"proverb","example":"I applied for the job anyway — nothing ventured, nothing gained."}],
  "antonyms": [{"word":"easy come, easy go","meaningTH":"ได้มาง่าย ก็ไปง่าย","pos":"proverb","example":"He won the lottery but spent it all — easy come, easy go."},{"word":"take it easy","meaningTH":"ใจเย็นๆ / สบายๆ","pos":"phrase","example":"Don't stress — take it easy."}],
  "keyWords": [{"word":"gain","cefr":"A2","pos":"noun/verb","definitionEN":"Something achieved; to obtain","definitionTH":"สิ่งที่ได้มา / ได้รับ","synonyms":[{"word":"profit","meaningTH":"กำไร"},{"word":"achieve","meaningTH":"บรรลุ"}],"antonyms":[{"word":"loss","meaningTH":"การสูญเสีย"},{"word":"lose","meaningTH":"สูญเสีย"}]}],
  "examples": [
    {"en":"I trained every day for months. No pain, no gain!","th":"ฉันฝึกทุกวันเป็นเดือน ไม่เจ็บก็ไม่ได้ผล!"},
    {"en":"Studying is hard, but no pain, no gain — you'll pass the exam.","th":"การเรียนมันยาก แต่ไม่ลำบากก็ไม่สำเร็จ — เธอจะสอบผ่าน"},
    {"en":"She worked two jobs to save money. No pain, no gain.","th":"เธอทำงานสองที่เพื่อเก็บเงิน ไม่เหนื่อยก็ไม่ได้ผล"}
  ],
  "usage": "Informal",
  "context": "Motivation, fitness, self-improvement"
}` : `{
  "idiom": "Hit the nail on the head",
  "cefr": "B2",
  "partOfSpeech": "verb phrase",
  "category": "idiom",
  "date": "${new Date().toISOString().split("T")[0]}",
  "thumbnail": "🎯",
  "color": "#FF6B6B",
  "tiktokUrl": "",
  "definitionEN": "To be precisely correct about something.",
  "definitionTH": "พูดถูกต้องแม่นยำ / ตรงประเด็น",
  "synonyms": [{"word":"be spot on","meaningTH":"ถูกต้องเป๊ะ","pos":"verb phrase","example":"You were spot on about the deadline."},{"word":"be exactly right","meaningTH":"ถูกต้องแม่นยำ","pos":"verb phrase","example":"She was exactly right."}],
  "antonyms": [{"word":"miss the point","meaningTH":"พลาดประเด็น","pos":"verb phrase","example":"He missed the point entirely."},{"word":"be off the mark","meaningTH":"ผิดเป้า","pos":"verb phrase","example":"Your guess was off the mark."}],
  "keyWords": [{"word":"nail","cefr":"A1","pos":"noun","definitionEN":"A small metal spike hammered into wood","definitionTH":"ตะปู","synonyms":[{"word":"pin","meaningTH":"เข็มหมุด"},{"word":"spike","meaningTH":"หนาม"}],"antonyms":[]}],
  "examples": [
    {"en":"She hit the nail on the head with her analysis.","th":"เธอพูดได้ตรงประเด็นมากกับการวิเคราะห์"},
    {"en":"The critic hit the nail on the head with his review.","th":"นักวิจารณ์พูดได้ถูกต้องแม่นยำมากกับบทวิจารณ์"},
    {"en":"You hit the nail on the head — that's exactly the problem.","th":"คุณพูดถูกเลย — นั่นแหละคือปัญหา"}
  ],
  "usage": "Formal & Informal",
  "context": "Work, discussion, debate"
}`;

  return (
    <>
      <div className={`admin-backdrop ${open ? "open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`admin-panel ${open ? "open" : ""}`} aria-label="Side panel">
        <div className="admin-panel-header">
          <div className="admin-panel-title"><span>⚙️</span><span>{userSession ? userSession.displayName : tab === "register" ? "Register" : "Sign in"}</span></div>
          <button className="admin-panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tab nav (only when logged in) */}
        {userSession && (
          <div className="panel-tabs">
            {userSession.role === "admin" && <button className={`panel-tab ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>📝 Admin</button>}
            {userSession.role === "admin" && <button className={`panel-tab ${tab === "users" ? "active" : ""}`} onClick={() => { setTab("users"); fetchUsers(); }}>👥 Users</button>}
            <button className={`panel-tab ${tab === "deck" ? "active" : ""}`} onClick={() => setTab("deck")}>💾 My Deck</button>
            <button className={`panel-tab ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>⚙️ Settings</button>
            <button className="panel-tab" onClick={handleLogout}>🚪</button>
          </div>
        )}

        <div className="admin-panel-body">
          {/* ─── Not logged in: Login / Register ─── */}
          {!userSession && (
            <>
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
                  {regResult && <div className={`admin-result ${regResult.startsWith("✅") ? "ok" : "err"}`} style={{ whiteSpace: "pre-line" }}>{regResult}</div>}
                  <button className="admin-login-btn" type="submit" disabled={regLoading}>{regLoading ? <><span className="spin">↻</span> Registering…</> : <>📝 Register</>}</button>
                  <p className="admin-hint" style={{ marginTop: 8, whiteSpace: "pre-line" }}>After registering, please wait for admin to approve your account, then sign in again.{"\n"}หลังจากลงทะเบียน กรุณารอให้ admin อนุมัติ แล้วลงชื่อเข้าใช้อีกครั้ง</p>
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
                  <p className="admin-hint">{savedWords.length} words saved — <a href="/deck" style={{ color: "var(--slate)" }}>open deck</a> to review</p>
                )}
              </div>
            </div>
          )}

          {/* ─── Settings tab ─── */}
          {userSession && tab === "settings" && (
            <div>
              <div className="admin-section-label">⚙️ Account Settings</div>
              <form className="admin-login-form" onSubmit={async (e) => {
                e.preventDefault();
                setSettingsLoading(true); setSettingsResult(null);
                // Validate confirm password
                if (settingsNewPass && settingsNewPass !== settingsConfirmPass) {
                  setSettingsResult("❌ New passwords do not match.");
                  setSettingsLoading(false); return;
                }
                if (settingsNewPass && settingsNewPass.length < 6) {
                  setSettingsResult("❌ New password must be at least 6 characters.");
                  setSettingsLoading(false); return;
                }
                try {
                  const res = await fetch("/api/users/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: userSession.id,
                      displayName: settingsName.trim() || undefined,
                      currentPassword: settingsCurPass || undefined,
                      newPassword: settingsNewPass || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) { setSettingsResult(`❌ ${data.error}`); setSettingsLoading(false); return; }
                  setSettingsResult("✅ Settings updated successfully!");
                  setSettingsCurPass(""); setSettingsNewPass(""); setSettingsConfirmPass("");
                  // Update displayed name across the app
                  if (data.displayName && onUpdateName) {
                    onUpdateName(data.displayName);
                  }
                  onToast("Settings saved", "success");
                } catch { setSettingsResult("❌ Network error."); }
                setSettingsLoading(false);
              }}>
                <div className="admin-field">
                  <label className="admin-label" htmlFor="sp-settings-name">Display Name</label>
                  <input id="sp-settings-name" className="admin-input" value={settingsName} onChange={e => setSettingsName(e.target.value)} placeholder="Your display name" />
                </div>
                <div style={{ borderTop: "1px solid var(--border)", margin: "16px 0", paddingTop: 16 }}>
                  <div className="admin-section-label" style={{ marginBottom: 12 }}>🔒 Change Password</div>
                  <div className="admin-field">
                    <label className="admin-label" htmlFor="sp-settings-curpass">Current Password</label>
                    <input id="sp-settings-curpass" className="admin-input" type="password" value={settingsCurPass} onChange={e => setSettingsCurPass(e.target.value)} placeholder="Required to change password" autoComplete="current-password" />
                  </div>
                  <div className="admin-field">
                    <label className="admin-label" htmlFor="sp-settings-newpass">New Password (min 6 chars)</label>
                    <input id="sp-settings-newpass" className="admin-input" type="password" value={settingsNewPass} onChange={e => setSettingsNewPass(e.target.value)} placeholder="Leave blank to keep current" minLength={6} autoComplete="new-password" />
                  </div>
                  <div className="admin-field">
                    <label className="admin-label" htmlFor="sp-settings-confirm">Confirm New Password</label>
                    <input id="sp-settings-confirm" className="admin-input" type="password" value={settingsConfirmPass} onChange={e => setSettingsConfirmPass(e.target.value)} placeholder="Re-enter new password" autoComplete="new-password" />
                  </div>
                </div>
                {settingsResult && <div className={`admin-result ${settingsResult.startsWith("✅") ? "ok" : "err"}`}>{settingsResult}</div>}
                <button className="admin-login-btn" type="submit" disabled={settingsLoading}>{settingsLoading ? <><span className="spin">↻</span> Saving…</> : <>💾 Save Settings</>}</button>
              </form>
            </div>
          )}

          {/* ─── Admin: Add idiom ─── */}
          {userSession?.role === "admin" && tab === "admin" && (
            <>
              <div className="admin-card">
                <div className="admin-section-label">📝 เพิ่ม {addCategory === "idiom" ? "Idiom" : addCategory === "howtosay" ? "How to Say" : "Inspiring"} (Paste JSON)</div>
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
                    const categoryWord = addCategory === "howtosay" ? "phrase" : addCategory === "motto" ? "inspiring quote" : "idiom";
                    const prompt = `Create a JSON object for the English ${categoryWord} "[REPLACE THIS WITH THE ${categoryWord.toUpperCase()}]".

RULES:
- Output ONLY the raw JSON. No explanation, no markdown, no code fences.
- Every synonym and antonym MUST have "meaningTH" (Thai meaning).
- Every keyWord's synonyms and antonyms MUST also have "meaningTH".
- Every example MUST have both "en" and "th".
- Keep the "idiom" field name even if it's a phrase or inspiring quote.
- Include 3-5 synonyms, 3-5 antonyms, 2-3 keyWords, and 3 examples.
- Use today's date for "date" field.

EXACT FORMAT (copy this structure):
${sampleJson}`;
                    navigator.clipboard.writeText(prompt).then(() => onToast("Copied!", "success")).catch(() => onToast("Copy failed", "error"));
                  }} aria-label="Copy">📋 Copy</button>
                  <div style={{ background: "var(--off-white)", border: "1px solid var(--border)", borderRadius: 8, padding: "36px 12px 12px", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--slate)", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
                    {`📋 Click "Copy" above → Paste in ChatGPT → Replace "[REPLACE THIS...]" with your ${addCategory === "howtosay" ? "phrase" : addCategory === "motto" ? "inspiring quote" : "idiom"} → ChatGPT gives you paste-ready JSON → Paste it in the box above`}
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
                          <div className="admin-ep-meta">{u.email} · {u.phone ? `📱${u.phone}` : ""} · {u.age ? `${u.age}y` : ""} · <span style={{ color: u.status === "approved" ? "#27ae60" : u.status === "pending" ? "var(--orange)" : "var(--coral)" }}>{u.status}</span></div>
                          {u.expires_at && <div className="admin-ep-meta">Expires: {new Date(u.expires_at).toLocaleDateString("en-US")}</div>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                        {u.status === "pending" && <button className="edit-add-btn" onClick={() => handleUserAction(u.id, "approve")}>✅ Approve</button>}
                        {u.status === "approved" && <button className="edit-add-btn" style={{ borderColor: "var(--coral)", color: "var(--coral)", background: "rgba(241,122,126,0.06)" }} onClick={() => handleUserAction(u.id, "remove")}>🚫 Remove</button>}
                        {u.status === "removed" && <button className="edit-add-btn" onClick={() => handleUserAction(u.id, "approve")}>↩️ Reactivate</button>}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <input type="date" className="edit-input" style={{ width: 140, padding: "4px 8px", fontSize: 11 }}
                            defaultValue={u.expires_at ? u.expires_at.split("T")[0] : ""}
                            onChange={(e) => handleUserAction(u.id, "set_expiry", e.target.value || undefined)}
                          />
                          {u.expires_at && <button className="edit-remove-btn" style={{ width: 22, height: 22, fontSize: 10 }} onClick={() => handleUserAction(u.id, "set_expiry")} title="Remove expiry">✕</button>}
                        </span>
                        <button className="edit-add-btn" style={{ borderColor: "var(--coral)", color: "var(--coral)", background: "rgba(241,122,126,0.06)" }} onClick={() => {
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
  const [epMap, setEpMap] = useState<Map<string, number>>(new Map());
  const [adminOpen, setAdminOpen] = useState(false);
  const [panelInitialTab, setPanelInitialTab] = useState<"login"|"register">("login");
  const [adminToken, setAdminToken] = useState("");
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [creatingArticle, setCreatingArticle] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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

  // Analytics helper
  const trackEvent = useCallback((eventType: string, eventData?: Record<string, unknown>) => {
    const sessionId = sessionStorage.getItem("deck_userId") || "anon_" + Math.random().toString(36).slice(2);
    fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventType, eventData, userId: userSession?.id, sessionId }) }).catch(() => {});
  }, [userSession]);

  // Track page view once
  useEffect(() => { trackEvent("page_view"); }, [trackEvent]);

  // Filter & sort
  useEffect(() => {
    let result = [...videos];
    // Hide draft articles from non-admin viewers
    if (!adminToken) {
      result = result.filter(v => {
        const data = getIdiomData(v);
        return !(data && (data as unknown as Record<string, unknown>).draft === true);
      });
    }
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
  }, [videos, search, sort, cefrFilter, category, adminToken]);

  // Compute EP numbers: for each category, sort by date (oldest=1) and assign numbers
  useEffect(() => {
    const map = new Map<string, number>();
    const grouped: Record<string, Video[]> = {};
    for (const v of videos) {
      const d = getIdiomData(v);
      const cat = d ? (d as unknown as Record<string, string>).category || "idiom" : "idiom";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(v);
    }
    for (const cat of Object.keys(grouped)) {
      grouped[cat].sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime());
      grouped[cat].forEach((v, i) => map.set(v.tiktok_id, i + 1));
    }
    setEpMap(map);
  }, [videos]);

  // Particles
  const particlesRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const c = particlesRef.current; if (!c) return; for (let i = 0; i < 20; i++) { const p = document.createElement("div"); p.className = "particle"; p.style.cssText = `left:${Math.random()*100}%;animation-duration:${6+Math.random()*10}s;animation-delay:${Math.random()*8}s;width:${1+Math.random()*3}px;height:${1+Math.random()*3}px;background:${Math.random()>.5?"#ff2d55":"#ffd60a"};`; c.appendChild(p); } }, []);

  const [showTop, setShowTop] = useState(false);
  useEffect(() => { const h = () => setShowTop(window.scrollY > 400); window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h); }, []);

  return (
    <>
      {/* TOP NAVIGATION BAR */}
      <nav className="top-nav" aria-label="Main navigation">
        <div className="top-nav-inner">
          <a href="/" className="top-nav-logo">Pattern<span>SpeakOut</span></a>
          <div className="top-nav-tabs">
            <button className={`top-nav-tab ${category === "all" ? "active" : ""}`} onClick={() => setCategory("all")}>All</button>
            <button className={`top-nav-tab ${category === "idiom" ? "active" : ""}`} onClick={() => setCategory("idiom")}>Idiom of the Day</button>
            <button className={`top-nav-tab ${category === "howtosay" ? "active" : ""}`} onClick={() => setCategory("howtosay")}>How to Say</button>
            <button className={`top-nav-tab ${category === "motto" ? "active" : ""}`} onClick={() => setCategory("motto")}>Inspiration</button>
            <button className={`top-nav-tab ${category === "articles" ? "active" : ""}`} onClick={() => setCategory("articles")}>Articles</button>
          </div>
          <div className="top-nav-actions">
            {!userSession && (
              <>
                <button className="header-auth-btn secondary" onClick={() => { setPanelInitialTab("login"); setAdminOpen(true); }}>Sign in</button>
                <button className="header-auth-btn primary" onClick={() => { setPanelInitialTab("register"); setAdminOpen(true); }}>Register</button>
              </>
            )}
            {userSession && <a href="/deck" className="deck-page-btn" style={{ marginRight: 4 }}>🃏 My Deck</a>}
            {adminToken && <a href="/stats" className="deck-page-btn" style={{ background: "rgba(155,89,182,0.08)", borderColor: "rgba(155,89,182,0.25)", color: "#a855f7", marginRight: 4 }}>📊 Stats</a>}
            <button className={`hamburger-btn ${adminOpen ? "active" : ""}`} onClick={() => setAdminOpen(v => !v)} aria-label={adminOpen ? "Close panel" : "Open panel"} aria-expanded={adminOpen}>
              <span className="hamburger-line" /><span className="hamburger-line" /><span className="hamburger-line" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hidden hero for particles (preserves JS) */}
      <div style={{ display: "none" }}><div ref={particlesRef} /></div>

      {/* HERO SECTION */}
      <section className="hero">
        <span className="channel-badge">LEARN ENGLISH FROM TIKTOK @PATTERNSPEAKOUT</span>
        <h1><span className="gradient-text">Practical English &amp; ideas, mapped to CEFR</span></h1>
        <p className="subtitle">เรียนรู้ภาษาอังกฤษที่ใช้ได้จริงจาก TikTok และบทความ — พร้อมคำอธิบายไทย–อังกฤษและระดับ CEFR</p>
      </section>

      <SidePanel open={adminOpen} onClose={() => setAdminOpen(false)} onToast={showToast} onRefresh={() => fetchVideos(true)} initialTab={panelInitialTab}
        onUpdateName={(name) => setUserSession(prev => prev ? { ...prev, displayName: name } : prev)}
        onAuth={(t, role, displayName) => {
          if (role === "admin") { setAdminToken(t); setUserSession({ id: "admin", email: "admin", displayName: "admin_pimjaa13", role: "admin" }); sessionStorage.setItem("deck_userId", "admin"); sessionStorage.setItem("admin_token", t); }
          else if (role === "user" && t) {
            setAdminToken("");
            // Fetch user info from token (user UUID)
            fetch(`/api/favourites?userId=${t}`).then(r => r.json()).then(d => { if (d.favourites) setFavourites(new Set(d.favourites)); if (d.words) setSavedWords(d.words); });
            setUserSession({ id: t, email: "", displayName: displayName || "User", role: "user" });
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

      {/* Controls */}
      <nav className="controls-bar" aria-label="Filter and search">
        <div className="controls-inner">
          <div className="search-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search" autoComplete="off" id="searchInput" />
          </div>
          <div className="filter-group" role="group" aria-label="CEFR filter">
            {["all", "A1", "A2", "B1", "B2", "C1", "C2"].map(level => (
              <button key={level} className={`filter-btn ${cefrFilter === level ? "active" : ""}`} data-cefr={level !== "all" ? level : undefined} onClick={() => setCefrFilter(level)}>
                {level === "all" ? "All levels" : level}
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
        {/* Admin toolbar */}
        {adminToken && category === "articles" && (
          <div className="admin-toolbar">
            <div className="admin-toolbar-left">
              <h2 className="admin-toolbar-title">Article Management</h2>
              <span className="admin-toolbar-count">{filtered.length} articles</span>
            </div>
            <div className="admin-toolbar-right">
              <button className="admin-toolbar-btn secondary" onClick={() => {
                navigator.clipboard.writeText(ARTICLE_AI_PROMPT).then(() => showToast("AI prompt copied!", "success")).catch(() => showToast("Copy failed", "error"));
              }}>📋 Copy AI JSON prompt</button>
              <button className="admin-toolbar-btn secondary" onClick={() => setImportOpen(true)}>📥 Import article JSON</button>
              <button className="admin-toolbar-btn" onClick={() => setCreatingArticle(true)}>➕ Add article</button>
            </div>
          </div>
        )}
        {adminToken && category !== "articles" && (
          <div className="admin-toolbar">
            <div className="admin-toolbar-left">
              <h2 className="admin-toolbar-title">Content Management</h2>
              <span className="admin-toolbar-count">{videos.length} episodes</span>
            </div>
            <div className="admin-toolbar-right">
              <select className="admin-toolbar-select" value={addCategory} onChange={(e) => setAddCategory(e.target.value)}>
                <option value="idiom">Idiom</option>
                <option value="howtosay">How to Say</option>
                <option value="motto">Inspiring</option>
                <option value="articles">Article</option>
              </select>
              <button className="admin-toolbar-btn" onClick={() => { setAdminOpen(true); }}>➕ Add content</button>
            </div>
          </div>
        )}

        {/* Pronunciation hint */}
        <div className="pronunciation-hint">
          <span>Tap 🔊 to hear the pronunciation</span>
          <span className="hint-thai">| กด 🔊 เพื่อฟังการออกเสียง</span>
        </div>

        <div className="section-header">
          <h2 className="section-title"><span className="dot" aria-hidden="true" />{category === "all" ? "Latest" : category === "idiom" ? "Idioms" : category === "howtosay" ? "How to Say" : category === "articles" ? "Articles" : "Inspiration"}</h2>
          <div className="result-count" aria-live="polite">{loading ? "กำลังโหลด…" : `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`}</div>
        </div>
        <div className="idiom-grid" role="list">
          {loading && <SkeletonGrid />}
          {!loading && error && (
            <div className="error-state"><span style={{ fontSize: 48 }}>⚠️</span><h3>ไม่สามารถโหลดข้อมูลได้</h3><p>{error}</p><button className="retry-btn" onClick={() => fetchVideos()}>ลองอีกครั้ง</button></div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="no-results"><span className="no-results-emoji">{search ? "🔍" : "📭"}</span><h3>{search ? "No results found" : category === "articles" ? "No articles yet" : "No content yet"}</h3><p>{search ? "Try a different search term or filter" : "Sign in (☰) to add new content"}</p></div>
          )}
          {!loading && !error && filtered.map((video, i) => {
            const d = getIdiomData(video);
            const cat = d ? (d as unknown as Record<string, string>).category || "idiom" : "idiom";
            const catLabel = cat === "idiom" ? "Idiom of the Day" : cat === "howtosay" ? "How to Say" : cat === "motto" ? "Inspiring" : cat === "articles" ? "Article" : cat;
            return (
            <VideoCard key={video.id} video={video} index={i}
              onClick={() => setSelectedVideo({ video, index: i })}
              isAdmin={!!adminToken}
              epNumber={epMap.get(video.tiktok_id) ?? (i + 1)}
              categoryLabel={catLabel}
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
              onGuestFav={!userSession ? () => { setPanelInitialTab("login"); setAdminOpen(true); showToast("Please sign in to save favorites", "error"); } : undefined}
            />
            );
          })}
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
      {selectedVideo && (isArticleData(getIdiomData(selectedVideo.video)) ? (
        <ArticleModal video={selectedVideo.video} epNumber={epMap.get(selectedVideo.video.tiktok_id) ?? (selectedVideo.index + 1)} onClose={() => setSelectedVideo(null)}
          isAdmin={!!adminToken}
          onEdit={() => { const v = selectedVideo.video; setSelectedVideo(null); setEditingVideo(v); }}
          savedWordIds={new Set(savedWords.map(w => w.id))}
          onSaveWord={userSession ? async (wordId, wordData) => {
            try {
              await fetch("/api/favourites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: userSession.id, tiktokId: wordId, action: "add", itemType: "word", wordData }) });
              setSavedWords(prev => [...prev, { id: wordId, data: wordData }]);
              showToast(`📝 "${(wordData as {word?:string}).word}" saved to deck!`, "success");
            } catch { /* ignore */ }
          } : undefined}
        />
      ) : (
        <DetailModal video={selectedVideo.video} index={selectedVideo.index} epNumber={epMap.get(selectedVideo.video.tiktok_id) ?? (selectedVideo.index + 1)} onClose={() => setSelectedVideo(null)}
          userSession={userSession}
          savedWordIds={new Set(savedWords.map(w => w.id))}
          onSaveWord={userSession ? async (wordId, wordData) => {
            try {
              await fetch("/api/favourites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: userSession.id, tiktokId: wordId, action: "add", itemType: "word", wordData }) });
              setSavedWords(prev => [...prev, { id: wordId, data: wordData }]);
              showToast(`📝 "${(wordData as {word?:string}).word}" saved to deck!`, "success");
            } catch { /* ignore */ }
          } : undefined}
        />
      ))}
      {editingVideo && (isArticleData(getIdiomData(editingVideo))
        ? <ArticleEditModal video={editingVideo} token={adminToken} onClose={() => setEditingVideo(null)} onSaved={() => fetchVideos(true)} onToast={showToast} />
        : <EditModal video={editingVideo} token={adminToken} onClose={() => setEditingVideo(null)} onSaved={() => fetchVideos(true)} onToast={showToast} />
      )}
      {creatingArticle && <ArticleEditModal video={null} token={adminToken} onClose={() => setCreatingArticle(false)} onSaved={() => fetchVideos(true)} onToast={showToast} />}
      {importOpen && <ArticleImportModal token={adminToken} existingIds={new Set(videos.map(v => v.tiktok_id))} onClose={() => setImportOpen(false)} onSaved={() => fetchVideos(true)} onToast={showToast} />}
      <Toast msg={toast.msg} type={toast.type} />
    </>
  );
}
