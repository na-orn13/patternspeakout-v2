/**
 * Seed rows derived from the original static data.js idioms.
 * Used by /api/sync when no real TikTok API token is configured.
 * Each row maps to the `videos` table schema.
 */

export interface VideoRow {
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
  summary?: string;
  summary_source: "caption" | "transcript" | "manual";
}

export const SEED_VIDEOS: VideoRow[] = [
  {
    tiktok_id: "seed_ep001",
    title: "Idiom of the Day: Hit the nail on the head",
    caption:
      "🎯 Hit the nail on the head — to be exactly right about something. CEFR B2. " +
      "Example: 'When she said the project failed due to poor communication, she really hit the nail on the head.' " +
      "Definition TH: พูดถูกต้องแม่นยำ / ตรงประเด็น #idiomoftheday #learnenglish #englishidioms #patternspeakout",
    cover_image_url: "",
    share_url: "https://www.tiktok.com/@patternspeakout",
    duration: 45,
    published_at: "2024-01-08T08:00:00Z",
    view_count: 12400,
    like_count: 890,
    comment_count: 45,
    share_count: 120,
    summary_source: "caption",
  },
  {
    tiktok_id: "seed_ep002",
    title: "Idiom of the Day: Break the ice",
    caption:
      "🧊 Break the ice — to relieve tension in a social situation. CEFR B1. " +
      "Example: 'He told a funny joke to break the ice at the beginning of the meeting.' " +
      "Definition TH: ทำให้บรรยากาศผ่อนคลายขึ้น #idiomoftheday #learnenglish #patternspeakout",
    cover_image_url: "",
    share_url: "https://www.tiktok.com/@patternspeakout",
    duration: 38,
    published_at: "2024-01-09T08:00:00Z",
    view_count: 18700,
    like_count: 1340,
    comment_count: 67,
    share_count: 210,
    summary_source: "caption",
  },
  {
    tiktok_id: "seed_ep003",
    title: "Idiom of the Day: Bite the bullet",
    caption:
      "💪 Bite the bullet — to endure a painful situation with courage. CEFR B2. " +
      "Example: 'I didn't want to have the difficult conversation, but I bit the bullet and talked to my boss.' " +
      "Definition TH: กัดฟันสู้ #idiomoftheday #learnenglish #patternspeakout",
    cover_image_url: "",
    share_url: "https://www.tiktok.com/@patternspeakout",
    duration: 42,
    published_at: "2024-01-10T08:00:00Z",
    view_count: 9200,
    like_count: 710,
    comment_count: 33,
    share_count: 95,
    summary_source: "caption",
  },
  {
    tiktok_id: "seed_ep004",
    title: "Idiom of the Day: Spill the beans",
    caption:
      "🫘 Spill the beans — to accidentally reveal a secret. CEFR B1. " +
      "Example: 'Don't spill the beans about the surprise party!' " +
      "Definition TH: เปิดเผยความลับโดยไม่ตั้งใจ #idiomoftheday #learnenglish #patternspeakout",
    cover_image_url: "",
    share_url: "https://www.tiktok.com/@patternspeakout",
    duration: 40,
    published_at: "2024-01-11T08:00:00Z",
    view_count: 15300,
    like_count: 1120,
    comment_count: 58,
    share_count: 180,
    summary_source: "caption",
  },
  {
    tiktok_id: "seed_ep005",
    title: "Idiom of the Day: Cost an arm and a leg",
    caption:
      "💸 Cost an arm and a leg — to be extremely expensive. CEFR B1. " +
      "Example: 'That new iPhone costs an arm and a leg, but people still buy it.' " +
      "Definition TH: แพงมาก #idiomoftheday #learnenglish #patternspeakout",
    cover_image_url: "",
    share_url: "https://www.tiktok.com/@patternspeakout",
    duration: 35,
    published_at: "2024-01-12T08:00:00Z",
    view_count: 22100,
    like_count: 1890,
    comment_count: 92,
    share_count: 340,
    summary_source: "caption",
  },
  {
    tiktok_id: "seed_ep006",
    title: "Idiom of the Day: Under the weather",
    caption:
      "🤒 Under the weather — feeling slightly ill or unwell. CEFR B1. " +
      "Example: 'I'm feeling a bit under the weather today — I might skip the gym.' " +
      "Definition TH: รู้สึกไม่สบาย #idiomoftheday #learnenglish #patternspeakout",
    cover_image_url: "",
    share_url: "https://www.tiktok.com/@patternspeakout",
    duration: 33,
    published_at: "2024-01-13T08:00:00Z",
    view_count: 11500,
    like_count: 830,
    comment_count: 41,
    share_count: 110,
    summary_source: "caption",
  },
  {
    tiktok_id: "seed_ep007",
    title: "Idiom of the Day: Kill two birds with one stone",
    caption:
      "🪨 Kill two birds with one stone — to accomplish two things with a single action. CEFR B1. " +
      "Example: 'I'll drop the kids off at school on my way to work — killing two birds with one stone.' " +
      "Definition TH: ทำสองอย่างได้ในคราวเดียว #idiomoftheday #learnenglish #patternspeakout",
    cover_image_url: "",
    share_url: "https://www.tiktok.com/@patternspeakout",
    duration: 48,
    published_at: "2024-01-14T08:00:00Z",
    view_count: 19800,
    like_count: 1560,
    comment_count: 74,
    share_count: 265,
    summary_source: "caption",
  },
  {
    tiktok_id: "seed_ep008",
    title: "Idiom of the Day: Let the cat out of the bag",
    caption:
      "🐱 Let the cat out of the bag — to accidentally reveal a secret surprise. CEFR B2. " +
      "Example: 'Tom let the cat out of the bag about the office renovation plans.' " +
      "Definition TH: เผลอบอกความลับ #idiomoftheday #learnenglish #patternspeakout",
    cover_image_url: "",
    share_url: "https://www.tiktok.com/@patternspeakout",
    duration: 41,
    published_at: "2024-01-15T08:00:00Z",
    view_count: 14200,
    like_count: 1050,
    comment_count: 52,
    share_count: 155,
    summary_source: "caption",
  },
  {
    tiktok_id: "seed_ep009",
    title: "Idiom of the Day: Burn the midnight oil",
    caption:
      "🕯️ Burn the midnight oil — to work or study late into the night. CEFR B2. " +
      "Example: 'She burned the midnight oil to finish the presentation for her boss.' " +
      "Definition TH: อดนอนทำงาน #idiomoftheday #learnenglish #patternspeakout",
    cover_image_url: "",
    share_url: "https://www.tiktok.com/@patternspeakout",
    duration: 44,
    published_at: "2024-01-16T08:00:00Z",
    view_count: 16900,
    like_count: 1240,
    comment_count: 61,
    share_count: 195,
    summary_source: "caption",
  },
  {
    tiktok_id: "seed_ep010",
    title: "Idiom of the Day: Bite off more than you can chew",
    caption:
      "😬 Bite off more than you can chew — to take on a task too difficult to handle. CEFR B2. " +
      "Example: 'He agreed to manage three projects simultaneously and bit off more than he could chew.' " +
      "Definition TH: รับงานมากเกินกว่าจะรับมือไหว #idiomoftheday #learnenglish #patternspeakout",
    cover_image_url: "",
    share_url: "https://www.tiktok.com/@patternspeakout",
    duration: 46,
    published_at: "2024-01-17T08:00:00Z",
    view_count: 13600,
    like_count: 980,
    comment_count: 48,
    share_count: 135,
    summary_source: "caption",
  },
  {
    tiktok_id: "seed_ep011",
    title: "Idiom of the Day: The ball is in your court",
    caption:
      "🎾 The ball is in your court — it is now your turn to take action or decide. CEFR B2. " +
      "Example: 'I've sent her the job offer — the ball is in her court now.' " +
      "Definition TH: ถึงตาคุณแล้ว #idiomoftheday #learnenglish #patternspeakout",
    cover_image_url: "",
    share_url: "https://www.tiktok.com/@patternspeakout",
    duration: 39,
    published_at: "2024-01-18T08:00:00Z",
    view_count: 20400,
    like_count: 1670,
    comment_count: 83,
    share_count: 290,
    summary_source: "caption",
  },
  {
    tiktok_id: "seed_ep012",
    title: "Idiom of the Day: Once in a blue moon",
    caption:
      "🌙 Once in a blue moon — something that happens very rarely. CEFR B1. " +
      "Example: 'Opportunities like this come once in a blue moon, so don't miss it!' " +
      "Definition TH: นานๆ ครั้ง #idiomoftheday #learnenglish #patternspeakout",
    cover_image_url: "",
    share_url: "https://www.tiktok.com/@patternspeakout",
    duration: 37,
    published_at: "2024-01-19T08:00:00Z",
    view_count: 25800,
    like_count: 2100,
    comment_count: 105,
    share_count: 380,
    summary_source: "caption",
  },
];
