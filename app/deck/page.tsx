"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Text-to-speech helper
function speakWord(text: string, lang: "en" | "th" = "en") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === "th" ? "th-TH" : "en-US";
  utterance.rate = lang === "th" ? 0.9 : 0.82;
  utterance.pitch = lang === "th" ? 1.0 : 1.05;
  const voices = window.speechSynthesis.getVoices();
  let preferred: SpeechSynthesisVoice | undefined;
  if (lang === "th") {
    preferred = voices.find(v => v.lang.startsWith("th") && v.name.includes("Google")) ??
      voices.find(v => v.lang.startsWith("th") && v.localService === false) ??
      voices.find(v => v.lang.startsWith("th"));
  } else {
    preferred = voices.find(v => v.lang.startsWith("en") && /Natural|Premium|Enhanced/i.test(v.name)) ??
      voices.find(v => v.lang.startsWith("en") && v.name.includes("Samantha")) ??
      voices.find(v => v.lang.startsWith("en") && v.name.includes("Daniel")) ??
      voices.find(v => v.lang.startsWith("en-US") && v.name.includes("Google")) ??
      voices.find(v => v.lang.startsWith("en-GB") && v.name.includes("Google")) ??
      voices.find(v => v.lang.startsWith("en") && v.localService === false) ??
      voices.find(v => v.lang.startsWith("en-US")) ??
      voices.find(v => v.lang.startsWith("en"));
  }
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}
function speakThai(text: string) { speakWord(text, "th"); }

interface WordItem {
  id: string;
  data: {
    word?: string;
    cefr?: string;
    pos?: string;
    definitionEN?: string;
    definitionTH?: string;
    synonyms?: string[];
    antonyms?: string[];
  };
  createdAt: string;
}

interface IdiomFav {
  tiktokId: string;
  idiom: string;
  cefr: string;
  definitionEN: string;
  definitionTH: string;
  thumbnail: string;
}

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CEFR_COLORS: Record<string, string> = { A1: "#27ae60", A2: "#2ecc71", B1: "#3498db", B2: "#a855f7", C1: "#e67e22", C2: "#e74c3c" };

export default function DeckPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [words, setWords] = useState<WordItem[]>([]);
  const [idioms, setIdioms] = useState<IdiomFav[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "words" | "idioms">("all");
  const [cefrFilter, setCefrFilter] = useState("all");
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  // Flashcard study mode
  const [studyFilter, setStudyFilter] = useState<"all"|"memorised"|"not_memorised">("all");
  const [cardStatuses, setCardStatuses] = useState<Record<string, string>>({});
  const [shuffledDeck, setShuffledDeck] = useState<Array<{id:string;type:string;front:string;backEN:string;backTH:string;cefr:string;pos:string;example:string}>>([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Fetch deck data
  const fetchDeck = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      // Fetch favourites
      const favRes = await fetch(`/api/favourites?userId=${uid}`);
      const favData = await favRes.json();
      if (favData.words) setWords(favData.words);

      // Fetch videos to match idiom favourites
      if (favData.favourites?.length > 0) {
        const vidRes = await fetch("/api/videos", { cache: "no-store" });
        const vidData = await vidRes.json();
        const favSet = new Set(favData.favourites as string[]);
        const matched: IdiomFav[] = [];
        for (const v of vidData.videos ?? []) {
          if (favSet.has(v.tiktok_id)) {
            try {
              const parsed = JSON.parse(v.summary || "{}");
              if (parsed.idiom) {
                matched.push({
                  tiktokId: v.tiktok_id,
                  idiom: parsed.idiom,
                  cefr: parsed.cefr || "B1",
                  definitionEN: parsed.definitionEN || "",
                  definitionTH: parsed.definitionTH || "",
                  thumbnail: parsed.thumbnail || "📖",
                });
              }
            } catch { /* skip */ }
          }
        }
        setIdioms(matched);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  // Check if user is already logged in (stored in sessionStorage)
  useEffect(() => {
    const stored = sessionStorage.getItem("deck_userId");
    if (stored) { setUserId(stored); fetchDeck(stored); }
    else setLoading(false);
  }, [fetchDeck]);

  // Fetch flashcard statuses when user is loaded
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/flashcard-status?userId=${userId}`)
      .then(r => r.json())
      .then(d => { if (d.statuses) setCardStatuses(d.statuses); })
      .catch(() => {});
  }, [userId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoginLoading(true); setLoginError("");
    try {
      const res = await fetch("/api/users/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: loginEmail, password: loginPass }) });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error); return; }
      setUserId(data.user.id);
      sessionStorage.setItem("deck_userId", data.user.id);
      fetchDeck(data.user.id);
    } catch { setLoginError("Network error."); }
    finally { setLoginLoading(false); }
  };

  const handleRemoveWord = async (wordId: string) => {
    if (!userId) return;
    try {
      await fetch("/api/favourites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, tiktokId: wordId, action: "remove", itemType: "word" }) });
      setWords(prev => prev.filter(w => w.id !== wordId));
    } catch { /* ignore */ }
  };

  const handleRemoveIdiom = async (tiktokId: string) => {
    if (!userId) return;
    try {
      await fetch("/api/favourites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, tiktokId, action: "remove", itemType: "idiom" }) });
      setIdioms(prev => prev.filter(i => i.tiktokId !== tiktokId));
    } catch { /* ignore */ }
  };

  // Build flashcard items
  const allCards = [
    ...words.map(w => ({
      id: w.id,
      type: "word" as const,
      front: w.data.word ?? "?",
      backEN: w.data.definitionEN ?? "",
      backTH: w.data.definitionTH ?? "",
      cefr: w.data.cefr ?? "B1",
      pos: w.data.pos ?? "",
      example: (w.data as { example?: string }).example ?? "",
    })),
    ...idioms.map(i => ({
      id: i.tiktokId,
      type: "idiom" as const,
      front: i.idiom,
      backEN: i.definitionEN,
      backTH: i.definitionTH,
      cefr: i.cefr,
      pos: "",
      example: "",
    })),
  ];

  const filteredCards = cefrFilter === "all" ? allCards : allCards.filter(c => c.cefr === cefrFilter);
  const filteredWords = cefrFilter === "all" ? words : words.filter(w => (w.data.cefr ?? "B1") === cefrFilter);
  const filteredIdioms = cefrFilter === "all" ? idioms : idioms.filter(i => i.cefr === cefrFilter);

  // ─── Not logged in ─────────────────────────────────────────────────────────
  if (!userId && !loading) {
    return (
      <div className="deck-page">
        <div className="deck-header">
          <button className="deck-back" onClick={() => router.back()}>← Back</button>
          <h1 className="deck-title">💾 My Deck</h1>
        </div>
        <div className="deck-login-box">
          <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>Please sign in from the main page first to access your deck.</p>
          <Link href="/" className="deck-flashcard-btn" style={{ textDecoration: "none" }}>← Go to main page &amp; sign in</Link>
        </div>
      </div>
    );
  }

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="deck-page">
        <div className="deck-header">
          <button className="deck-back" onClick={() => router.back()}>← Back</button>
          <h1 className="deck-title">💾 My Deck</h1>
        </div>
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading…</div>
      </div>
    );
  }

  // ─── Helper: start flashcard session ────────────────────────────────────────
  const startFlashcardSession = (filter: "all"|"memorised"|"not_memorised") => {
    setStudyFilter(filter);
    let eligible = [...filteredCards];
    if (filter === "memorised") {
      eligible = eligible.filter(c => cardStatuses[c.id] === "memorised");
    } else if (filter === "not_memorised") {
      eligible = eligible.filter(c => cardStatuses[c.id] !== "memorised");
    }
    // Shuffle (Fisher-Yates)
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    setShuffledDeck(eligible);
    setStudyIndex(0);
    setFlashcardFlipped(false);
    setSessionComplete(false);
    setFlashcardMode(true);
  };

  const handleStudyAction = async (status: "memorised"|"not_memorised") => {
    const card = shuffledDeck[studyIndex];
    if (!card || !userId) return;
    // Persist status
    setCardStatuses(prev => ({ ...prev, [card.id]: status }));
    fetch("/api/flashcard-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, cardId: card.id, status }),
    }).catch(() => {});
    // Move to next card
    setFlashcardFlipped(false);
    if (studyIndex + 1 >= shuffledDeck.length) {
      setSessionComplete(true);
    } else {
      setStudyIndex(i => i + 1);
    }
  };

  // ─── Flashcard Mode ────────────────────────────────────────────────────────
  if (flashcardMode) {
    const studyCard = shuffledDeck[studyIndex];
    return (
      <div className="deck-page">
        <div className="deck-header">
          <button className="deck-back" onClick={() => setFlashcardMode(false)}>← Exit Flashcards</button>
          <h1 className="deck-title">🃏 Flashcard Mode</h1>
          {!sessionComplete && shuffledDeck.length > 0 && (
            <div className="deck-counter">{studyIndex + 1} of {shuffledDeck.length}</div>
          )}
        </div>

        {/* Study filter tabs */}
        <div className="deck-controls" style={{ paddingBottom: 12 }}>
          <div className="deck-tabs">
            <button className={`panel-tab ${studyFilter === "all" ? "active" : ""}`} onClick={() => startFlashcardSession("all")}>All ({filteredCards.length})</button>
            <button className={`panel-tab ${studyFilter === "memorised" ? "active" : ""}`} onClick={() => startFlashcardSession("memorised")}>✅ Memorised ({filteredCards.filter(c => cardStatuses[c.id] === "memorised").length})</button>
            <button className={`panel-tab ${studyFilter === "not_memorised" ? "active" : ""}`} onClick={() => startFlashcardSession("not_memorised")}>❌ Not memorised ({filteredCards.filter(c => cardStatuses[c.id] !== "memorised").length})</button>
          </div>
          <div className="deck-cefr-bar">
            {["all", ...CEFR_LEVELS].map(level => (
              <button key={level} className={`filter-btn ${cefrFilter === level ? "active" : ""}`} data-cefr={level !== "all" ? level : undefined}
                onClick={() => { setCefrFilter(level); startFlashcardSession(studyFilter); }}>
                {level === "all" ? "All" : level}
              </button>
            ))}
          </div>
        </div>

        {sessionComplete ? (
          <div className="flashcard-area" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Session Complete!</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>You reviewed {shuffledDeck.length} card{shuffledDeck.length !== 1 ? "s" : ""}.</p>
            <div className="flashcard-nav">
              <button className="flashcard-nav-btn" onClick={() => startFlashcardSession(studyFilter)}>🔄 Restart</button>
              <button className="flashcard-nav-btn" onClick={() => startFlashcardSession("not_memorised")}>❌ Not memorised only</button>
              <button className="flashcard-nav-btn" onClick={() => setFlashcardMode(false)}>← Back to Deck</button>
            </div>
          </div>
        ) : shuffledDeck.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p>No cards in this category. Try a different filter.</p>
          </div>
        ) : (
          <div className="flashcard-area">
            <div className={`flashcard ${flashcardFlipped ? "flipped" : ""}`} onClick={() => { setFlashcardFlipped(f => { if (!f && studyCard) speakWord(studyCard.front); return !f; }); }} style={{ "--fc-cefr-color": CEFR_COLORS[studyCard?.cefr ?? "B1"] } as React.CSSProperties}>
              <div className="flashcard-inner">
                <div className="flashcard-front">
                  <div className="flashcard-cefr" style={{ background: CEFR_COLORS[studyCard?.cefr ?? "B1"] }}>{studyCard?.cefr}</div>
                  <div className="flashcard-word">{studyCard?.front}</div>
                  <div className="flashcard-hint">Tap to reveal</div>
                </div>
                <div className="flashcard-back">
                  <div className="flashcard-cefr" style={{ background: CEFR_COLORS[studyCard?.cefr ?? "B1"] }}>{studyCard?.cefr}</div>
                  <div className="flashcard-word" style={{ fontSize: 20 }}>{studyCard?.front}</div>
                  {studyCard?.pos && <div className="flashcard-pos">{studyCard.pos}</div>}
                  <div className="flashcard-def-en">🇬🇧 {studyCard?.backEN} {studyCard?.backEN && <button className="speak-btn-sm" onClick={(e) => { e.stopPropagation(); speakWord(studyCard.backEN); }} title="Listen">🔊</button>}</div>
                  <div className="flashcard-def-th">🇹🇭 {studyCard?.backTH} {studyCard?.backTH && <button className="speak-btn-sm" onClick={(e) => { e.stopPropagation(); speakThai(studyCard.backTH); }} title="ฟังภาษาไทย">🔊</button>}</div>
                  {studyCard?.example && <div className="flashcard-example">💬 {studyCard.example}</div>}
                </div>
              </div>
            </div>

            <div className="flashcard-nav">
              <button className="flashcard-nav-btn" style={{ background: "#27ae60", color: "white", borderColor: "#27ae60" }} onClick={() => handleStudyAction("memorised")}>✅ Memorised</button>
              <button className="flashcard-nav-btn" style={{ background: "var(--coral)", color: "white", borderColor: "var(--coral)" }} onClick={() => handleStudyAction("not_memorised")}>❌ Not memorised</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Normal Deck View ──────────────────────────────────────────────────────
  return (
    <div className="deck-page">
      <div className="deck-header">
        <button className="deck-back" onClick={() => router.back()}>← Back to Idioms</button>
        <h1 className="deck-title">💾 My Deck</h1>
        <div className="deck-stats">
          <span>{words.length} words</span>
          <span>{idioms.length} idioms</span>
        </div>
      </div>

      {/* Controls */}
      <div className="deck-controls">
        <div className="deck-tabs">
          <button className={`panel-tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>All</button>
          <button className={`panel-tab ${tab === "words" ? "active" : ""}`} onClick={() => setTab("words")}>📝 Words ({filteredWords.length})</button>
          <button className={`panel-tab ${tab === "idioms" ? "active" : ""}`} onClick={() => setTab("idioms")}>📖 Idioms ({filteredIdioms.length})</button>
        </div>

        <div className="deck-cefr-bar">
          {["all", ...CEFR_LEVELS].map(level => (
            <button key={level} className={`filter-btn ${cefrFilter === level ? "active" : ""}`} data-cefr={level !== "all" ? level : undefined}
              onClick={() => setCefrFilter(level)}>
              {level === "all" ? "All" : level}
            </button>
          ))}
        </div>

        <button className="deck-flashcard-btn" onClick={() => startFlashcardSession("all")} disabled={filteredCards.length === 0}>
          🃏 Flashcard Mode ({filteredCards.length} cards)
        </button>
      </div>

      {/* Word list */}
      {(tab === "all" || tab === "words") && filteredWords.length > 0 && (
        <div className="deck-section">
          {tab === "all" && <div className="deck-section-label">📝 Words</div>}
          <div className="deck-word-grid">
            {filteredWords.map(w => (
              <div key={w.id} className="deck-word-card">
                <div className="deck-word-top">
                  <span className="deck-word-name">{w.data.word} <button className="speak-btn" onClick={() => speakWord(w.data.word ?? "")} title="Listen">🔊</button></span>
                  <span className={`tag tag-cefr ${w.data.cefr}`} style={{ fontSize: 10 }}>{w.data.cefr}</span>
                  {w.data.pos && <span className="tag tag-pos" style={{ fontSize: 10 }}>{w.data.pos}</span>}
                  <button className="deck-remove-btn" onClick={() => handleRemoveWord(w.id)}>✕</button>
                </div>
                <div className="deck-word-def-en">🇬🇧 {w.data.definitionEN} <button className="speak-btn-sm" onClick={() => speakWord(w.data.definitionEN ?? "")} title="Listen">🔊</button></div>
                <div className="deck-word-def-th">🇹🇭 {w.data.definitionTH} <button className="speak-btn-sm" onClick={() => speakThai(w.data.definitionTH ?? "")} title="ฟังภาษาไทย">🔊</button></div>
                {"example" in (w.data as object) && (w.data as Record<string, string>).example && (
                  <div className="deck-word-extra" style={{ fontStyle: "italic", color: "var(--text-secondary)" }}>Ex: {(w.data as Record<string, string>).example}</div>
                )}
                {w.data.synonyms && (w.data.synonyms as string[]).length > 0 && (
                  <div className="deck-word-extra">Syn: {(w.data.synonyms as string[]).join(", ")}</div>
                )}
                {w.data.antonyms && (w.data.antonyms as string[]).length > 0 && (
                  <div className="deck-word-extra">Ant: {(w.data.antonyms as string[]).join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Idiom list */}
      {(tab === "all" || tab === "idioms") && filteredIdioms.length > 0 && (
        <div className="deck-section">
          {tab === "all" && <div className="deck-section-label">📖 Idioms</div>}
          <div className="deck-word-grid">
            {filteredIdioms.map(i => (
              <div key={i.tiktokId} className="deck-word-card">
                <div className="deck-word-top">
                  <span style={{ fontSize: 18 }}>{i.thumbnail}</span>
                  <span className="deck-word-name">{i.idiom}</span>
                  <span className={`tag tag-cefr ${i.cefr}`} style={{ fontSize: 10 }}>{i.cefr}</span>
                  <button className="deck-remove-btn" onClick={() => handleRemoveIdiom(i.tiktokId)}>✕</button>
                </div>
                <div className="deck-word-def-en">🇬🇧 {i.definitionEN} <button className="speak-btn-sm" onClick={() => speakWord(i.definitionEN)} title="Listen">🔊</button></div>
                <div className="deck-word-def-th">🇹🇭 {i.definitionTH} <button className="speak-btn-sm" onClick={() => speakThai(i.definitionTH)} title="ฟังภาษาไทย">🔊</button></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {filteredWords.length === 0 && filteredIdioms.length === 0 && (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={{ color: "var(--text-muted)" }}>
            {cefrFilter !== "all" ? `No ${cefrFilter} items saved yet.` : "Your deck is empty. Go save some idioms and words!"}
          </p>
          <Link href="/" className="deck-flashcard-btn" style={{ display: "inline-flex", marginTop: 16, textDecoration: "none" }}>← Browse Idioms</Link>
        </div>
      )}
    </div>
  );
}
