/**
 * Generates a structured idiom summary from a TikTok video caption.
 *
 * Uses Google Gemini 3.6 Flash via REST API — FREE tier:
 *   - 15 requests/minute, 1,500 requests/day
 *   - No credit card required
 *
 * Returns null if GEMINI_API_KEY is not configured (graceful degradation —
 * the raw caption is stored instead, clearly labelled).
 */
export async function summariseFromCaption(
  caption: string,
  title: string
): Promise<{ summary: string; source: "caption" } | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("[summarise] GEMINI_API_KEY not set — skipping AI summary.");
    return null;
  }

  const prompt = `You are an English language teacher writing for Thai learners.
Given the TikTok video title and caption below, produce a concise structured summary in this exact format:

**Idiom:** <the idiom>
**CEFR Level:** <A1/A2/B1/B2/C1/C2 — your best estimate>
**Part of Speech:** <e.g. verb phrase, adjective phrase, noun phrase>
**Definition (EN):** <clear English definition, 1–2 sentences>
**ความหมาย (TH):** <Thai translation of the definition>
**Synonyms:** <3–5 English synonyms or similar expressions, comma-separated>
**Antonyms:** <3–5 antonyms or opposite expressions, comma-separated>
**Example sentence:** <one natural example sentence using the idiom>
**Example (TH):** <Thai translation of the example sentence>

Title: ${title}
Caption: ${caption}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1200,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[summarise] Gemini HTTP error:", res.status, errBody.slice(0, 200));
      if (res.status === 429) {
        throw new Error(`Gemini rate limit: ${res.status}`);
      }
      return null;
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text?.trim() ?? "";
    const finishReason = candidate?.finishReason ?? "UNKNOWN";

    if (!text) {
      console.warn("[summarise] Gemini returned empty text. finishReason:", finishReason);
      return null;
    }

    console.log(`[summarise] OK — ${text.length} chars, finishReason: ${finishReason}`);
    return { summary: text, source: "caption" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[summarise] Error:", message);
    if (message.toLowerCase().includes("rate") || message.includes("429")) {
      throw new Error(`Gemini rate limit: ${message}`);
    }
    return null;
  }
}
