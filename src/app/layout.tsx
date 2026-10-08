import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Horse — A Stremio Client Built for Adventure",
  description:
    "Horse is an open-source media center and client for the Stremio addon protocol. Bring your own addons: catalogs, streams, subtitles. A faithful web port of the Harbor desktop app.",
  keywords: [
    "Horse",
    "Stremio",
    "addon protocol",
    "media center",
    "streaming",
    "open source",
  ],
  authors: [{ name: "Horse" }],
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon-64.png", type: "image/png", sizes: "64x64" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Hero is full-bleed under the status bar (installed PWA mode); black theme
  // color per the Home design spec (OLED black).
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-canvas text-ink" style={{ fontFamily: "var(--font-sans-var)" }}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
