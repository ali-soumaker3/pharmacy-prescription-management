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
  title: "ФармаКонтроль — Проверка рецептов и управление аптекой",
  description:
    "Цифровая система распознавания рецептов, контроля лекарственных взаимодействий и подтверждения отпуска фармацевтом.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F6F5F0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${golosText.variable} ${jetBrainsMono.variable}`}
    >
      <body className="min-h-dvh bg-[var(--bg-canvas)] font-sans text-[var(--ink-primary)] antialiased">
        {children}
      </body>
    </html>
  );
}
