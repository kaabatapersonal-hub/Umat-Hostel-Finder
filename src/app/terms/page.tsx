import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { LegalHeader } from "@/components/legal/legal-header";
import { LegalContent } from "@/components/legal/legal-content";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use Campa.",
};

export default async function TermsPage() {
  const markdown = await readFile(
    path.join(process.cwd(), "src/content/legal/terms-of-service.md"),
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
