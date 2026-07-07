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
    default: "UMaT Hostel Finder",
    template: "%s — UMaT Hostel Finder",
  },
  description,
  openGraph: {
    title: "UMaT Hostel Finder",
    description,
    siteName: "UMaT Hostel Finder",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "UMaT Hostel Finder",
    description,
  },
  // Generates both the Apple-specific tag and the generic
  // mobile-web-app-capable tag -- makes "Add to Home Screen" launch full-
  // screen (no browser chrome) instead of opening back into Safari/Chrome.
  appleWebApp: {
    capable: true,
    title: "UMaT Hostel Finder",
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
    <html lang="en" className={`${sora.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-surface-muted text-ink-900">
        <QueryProvider>
          <AuthProvider>
            <ConditionalAppShell>{children}</ConditionalAppShell>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
