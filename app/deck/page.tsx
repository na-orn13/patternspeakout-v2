"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
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

  const currentCard = filteredCards[flashcardIndex];

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

  // ─── Flashcard Mode ────────────────────────────────────────────────────────
  if (flashcardMode) {
    return (
      <div className="deck-page">
        <div className="deck-header">
          <button className="deck-back" onClick={() => setFlashcardMode(false)}>← Exit Flashcards</button>
          <h1 className="deck-title">🃏 Flashcard Mode</h1>
          <div className="deck-counter">{flashcardIndex + 1} / {filteredCards.length}</div>
        </div>

        {filteredCards.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>No cards in this filter. Try "All" CEFR levels.</div>
        ) : (
          <div className="flashcard-area">
            <div className={`flashcard ${flashcardFlipped ? "flipped" : ""}`} onClick={() => setFlashcardFlipped(f => !f)}>
              <div className="flashcard-inner">
                <div className="flashcard-front">
                  <div className="flashcard-cefr" style={{ background: CEFR_COLORS[currentCard?.cefr ?? "B1"] }}>{currentCard?.cefr}</div>
                  <div className="flashcard-word">{currentCard?.front}</div>
                  <div className="flashcard-hint">Tap to reveal</div>
                </div>
                <div className="flashcard-back">
                  <div className="flashcard-cefr" style={{ background: CEFR_COLORS[currentCard?.cefr ?? "B1"] }}>{currentCard?.cefr}</div>
                  <div className="flashcard-word" style={{ fontSize: 20 }}>{currentCard?.front}</div>
                  {currentCard?.pos && <div className="flashcard-pos">{currentCard.pos}</div>}
                  <div className="flashcard-def-en">🇬🇧 {currentCard?.backEN}</div>
                  <div className="flashcard-def-th">🇹🇭 {currentCard?.backTH}</div>
                  {currentCard?.example && <div className="flashcard-example">💬 {currentCard.example}</div>}
                </div>
              </div>
            </div>

            <div className="flashcard-nav">
              <button className="flashcard-nav-btn" disabled={flashcardIndex === 0} onClick={() => { setFlashcardIndex(i => i - 1); setFlashcardFlipped(false); }}>← Prev</button>
              <button className="flashcard-nav-btn" onClick={() => { setFlashcardFlipped(false); setFlashcardIndex(i => (i + 1) % filteredCards.length); }}>Next →</button>
            </div>
          </div>
        )}

        {/* CEFR filter for flashcards */}
        <div className="deck-cefr-bar">
          {["all", ...CEFR_LEVELS].map(level => (
            <button key={level} className={`filter-btn ${cefrFilter === level ? "active" : ""}`} data-cefr={level !== "all" ? level : undefined}
              onClick={() => { setCefrFilter(level); setFlashcardIndex(0); setFlashcardFlipped(false); }}>
              {level === "all" ? "All" : level}
            </button>
          ))}
        </div>
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

        <button className="deck-flashcard-btn" onClick={() => { setFlashcardMode(true); setFlashcardIndex(0); setFlashcardFlipped(false); }} disabled={filteredCards.length === 0}>
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
                  <span className="deck-word-name">{w.data.word}</span>
                  <span className={`tag tag-cefr ${w.data.cefr}`} style={{ fontSize: 10 }}>{w.data.cefr}</span>
                  {w.data.pos && <span className="tag tag-pos" style={{ fontSize: 10 }}>{w.data.pos}</span>}
                  <button className="deck-remove-btn" onClick={() => handleRemoveWord(w.id)}>✕</button>
                </div>
                <div className="deck-word-def-en">🇬🇧 {w.data.definitionEN}</div>
                <div className="deck-word-def-th">🇹🇭 {w.data.definitionTH}</div>
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
                <div className="deck-word-def-en">🇬🇧 {i.definitionEN}</div>
                <div className="deck-word-def-th">🇹🇭 {i.definitionTH}</div>
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
