import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Acompanhamento 2026",
  description: "Acompanhamento de cursistas da Região Norte"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
