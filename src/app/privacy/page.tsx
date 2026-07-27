import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { LegalHeader } from "@/components/legal/legal-header";
import { LegalContent } from "@/components/legal/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Campa collects, how it's used, and your rights over your data.",
};

export default async function PrivacyPage() {
  const markdown = await readFile(
    path.join(process.cwd(), "src/content/legal/privacy-policy.md"),
    "utf-8"
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <LegalHeader />
      <main className="flex-1">
        <LegalContent markdown={markdown} />
      </main>
    </div>
  );
}
