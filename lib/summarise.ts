import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Generates a structured idiom summary from a TikTok video caption.
 *
 * Uses Google Gemini 1.5 Flash — FREE tier:
 *   - 15 requests/minute
 *   - 1,500 requests/day
 *   - No credit card required
 *
 * Returns null if GEMINI_API_KEY is not configured (graceful degradation —
 * the raw caption is stored instead, clearly labelled).
 *
 * NOTE: TikTok's API does not provide transcripts via the Content/Login Kit API.
 * All summaries are therefore caption-based and clearly labelled as such.
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

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 600,
    },
  });

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

⚠️ This summary is based on the video caption only — no transcript was available from TikTok API.

Title: ${title}
Caption: ${caption}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return { summary: text, source: "caption" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[summarise] Gemini error:", message);

    // Surface rate-limit specifically so the caller can retry later
    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      throw new Error(`Gemini rate limit: ${message}`);
    }
    return null;
  }
}
