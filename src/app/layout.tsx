import type { Metadata } from "next";
import { JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { ThemeScript } from "@/components/theme-script";
import { Providers } from "@/components/providers";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ontrifice.dev"),
  title: {
    default: "Ontrifice",
    template: "%s | Ontrifice",
  },
  description:
    "Cross-market neg risk engine for prediction markets. Proves structural relationships between contracts across platforms to compute collateral-efficient portfolios.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Ontrifice",
    description:
      "Cross-market neg risk engine. Proves structural relationships between prediction market contracts to reduce collateral requirements.",
    type: "website",
    url: "https://ontrifice.dev",
    siteName: "Ontrifice",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${jetbrainsMono.variable} ${ibmPlexSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen flex flex-col">
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:border focus:border-border focus:px-3 focus:py-2 focus:text-sm focus:font-mono focus:text-accent focus:no-underline"
            style={{ borderRadius: "2px" }}
          >
            Skip to main content
          </a>
          <Navigation />
          <main id="main-content" className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
