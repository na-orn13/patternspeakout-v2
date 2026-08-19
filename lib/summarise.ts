import OpenAI from "openai";

/**
 * Generates a structured idiom summary from a TikTok video caption.
 * Returns null if OPENAI_API_KEY is not configured (graceful degradation).
 *
 * NOTE: TikTok's API does not provide transcripts via the Content/Login Kit API.
 * All summaries are therefore caption-based and clearly labelled as such.
 */
export async function summariseFromCaption(
  caption: string,
  title: string
): Promise<{ summary: string; source: "caption" } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[summarise] OPENAI_API_KEY not set — skipping AI summary.");
    return null;
  }

  const client = new OpenAI({ apiKey });

  const prompt = `You are an English language teacher writing for Thai learners.
Given the TikTok video title and caption below, produce a concise structured summary in this exact format:

**Idiom:** <the idiom>
**CEFR Level:** <A1/A2/B1/B2/C1/C2 — your best estimate>
**Part of Speech:** <e.g. verb phrase, adjective phrase>
**Definition (EN):** <clear English definition, 1–2 sentences>
**ความหมาย (TH):** <Thai translation of the definition>
**Synonyms:** <3–5 English synonyms or similar expressions, comma-separated>
**Antonyms:** <3–5 antonyms or opposite expressions, comma-separated>
**Example sentence:** <one natural example sentence using the idiom>
**Example (TH):** <Thai translation of the example sentence>

⚠️ This summary is based on the video caption only — no transcript was available.

Title: ${title}
Caption: ${caption}`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    return { summary: text, source: "caption" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[summarise] OpenAI error:", message);
    return null;
  }
}
