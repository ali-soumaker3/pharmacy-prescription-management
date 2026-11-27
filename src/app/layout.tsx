import type { Metadata, Viewport } from "next";
import { Golos_Text, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const golosText = Golos_Text({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ФармаКонтроль",
  description: "Проверка рецептов, учёт остатков и подтверждение заказов аптеки.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E9E7DF" },
    { media: "(prefers-color-scheme: dark)", color: "#121514" },
  ],
};

const THEME_INIT_SCRIPT =
  'try{var m=document.querySelector(\'meta[name="color-scheme"]\');var s=localStorage.getItem("color-scheme");if(m&&(s==="light"||s==="dark"))m.content=s;}catch(e){}';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${golosText.variable} ${jetBrainsMono.variable}`}
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-[var(--bg-canvas)] font-sans text-[var(--ink-primary)] antialiased">
        {children}
      </body>
    </html>
  );
}
