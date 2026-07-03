import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ConditionalAppShell } from "@/components/layout/conditional-app-shell";

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

export const metadata: Metadata = {
  title: "UMaT Hostel Finder",
  description: "Find your next hostel near UMaT — fast, trusted, and built for students.",
};

export const viewport: Viewport = {
  themeColor: "#0E4A34",
  width: "device-width",
  initialScale: 1,
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
