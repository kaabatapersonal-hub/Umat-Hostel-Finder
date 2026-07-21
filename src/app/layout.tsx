import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ConditionalAppShell } from "@/components/layout/conditional-app-shell";
import { getSiteUrl } from "@/lib/site-url";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const description = "Find your next hostel near UMaT — fast, trusted, and built for students.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Campa",
    template: "%s — Campa",
  },
  description,
  openGraph: {
    title: "Campa",
    description,
    siteName: "Campa",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Campa",
    description,
  },
  // Generates both the Apple-specific tag and the generic
  // mobile-web-app-capable tag -- makes "Add to Home Screen" launch full-
  // screen (no browser chrome) instead of opening back into Safari/Chrome.
  appleWebApp: {
    capable: true,
    title: "Campa",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E4A34",
  width: "device-width",
  initialScale: 1,
  // Without this, env(safe-area-inset-*) resolves to 0 on iOS regardless of
  // how the CSS uses it -- the fixed bottom nav's safe-area padding (and the
  // top bar's notch padding) have been silently no-ops without it.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Inline background color, not just the CSS class below -- this is the
    // very first thing the browser paints, before globals.css necessarily
    // has a chance to load, and the whole point is that it's never white.
    <html
      lang="en"
      className={`${sora.variable} ${inter.variable} h-full antialiased`}
      style={{ backgroundColor: "#0E4A34" }}
    >
      <body className="min-h-full flex flex-col bg-surface-muted text-ink-900">
        {/* Cold-launch splash -- plain server-rendered markup (no "use
            client", no JS required to appear), so it's part of the very
            first HTML the browser paints on every entry point: a fresh
            browser tab, and the installed PWA/home-screen launch this was
            actually reported for. Purely a CSS-timed fade (see
            globals.css's #app-splash rules) -- there's no hook coordinating
            it with hydration completing, deliberately, since that adds
            complexity for a decorative, sub-second element. */}
        <div id="app-splash" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
            <rect width="512" height="512" rx="118" fill="#0E4A34" />
            <path
              d="M256 79 C177 79 118 138 118 217 C118 310 256 443 256 443 C256 443 394 310 394 217 C394 138 335 79 256 79 Z"
              fill="#E8A33D"
            />
            <path d="M256 148 L335 217 L310 217 L310 286 L202 286 L202 217 L177 217 Z" fill="#0E4A34" />
          </svg>
        </div>
        <QueryProvider>
          <AuthProvider>
            <ConditionalAppShell>{children}</ConditionalAppShell>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
