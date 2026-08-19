import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "patternspeakout",
  description:
    "สรุป Idiom of the Day จากช่อง @patternspeakout บน TikTok พร้อมระดับ CEFR, คำจำกัดความภาษาไทย–อังกฤษ, คำพ้อง, คำตรงข้าม และตัวอย่างประโยค",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
