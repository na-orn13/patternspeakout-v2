/**
 * summarise.ts — DEPRECATED (kept for backward compatibility)
 *
 * AI-based summary generation has been removed in favor of manual structured
 * idiom data uploaded by the admin. This module now only provides a simple
 * caption fallback for videos that haven't been manually enriched yet.
 */
export async function summariseFromCaption(
  caption: string,
  _title: string
): Promise<{ summary: string; source: "caption" } | null> {
  // No AI — just return the caption as-is
  return {
    summary: caption,
    source: "caption",
  };
}
