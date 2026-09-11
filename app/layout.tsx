import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_SC, Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  axes: ["opsz"],
});

const notoSansSc = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  weight: ["400", "500", "700"],
  preload: false,
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "Anki Chat",
  description: "Slim chat UI for the Anki language-learning assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body
        className={`${inter.variable} ${notoSansSc.variable} ${ibmPlexMono.variable} antialiased`}
        style={{
          fontFamily: "var(--font-inter), var(--font-noto-sans-sc), system-ui, sans-serif",
        }}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
