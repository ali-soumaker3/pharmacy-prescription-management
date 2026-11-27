import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Аптека ИИ — Управление рецептами и заказами",
  description:
    "Система распознавания рецептов, проверки лекарственных взаимодействий и подтверждения заказов фармацевтом на базе Next.js, Supabase, n8n и OpenRouter.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
