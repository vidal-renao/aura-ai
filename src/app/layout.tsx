import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aura AI | Revenue Intelligence",
  description: "Revenue Growth Management y optimización de catálogo para empresas suizas.",
};

export const viewport: Viewport = { themeColor: "#EEF2F1" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
