import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

// One component map, reused by both /terms and /privacy, so a heading
// reads the same size/weight/spacing wherever it appears -- the markdown
// source's own heading levels (# title, ## section) map straight through
// to h1/h2, no level-shifting needed to get a correct, single-h1
// hierarchy per page.
const components: Components = {
  h1: ({ children }) => <h1 className="font-display text-display text-ink-900">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-10 font-display text-h1 text-ink-900">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 font-display text-h2 text-ink-900">{children}</h3>,
  p: ({ children }) => <p className="mt-3 text-body leading-relaxed text-ink-500">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink-900">{children}</strong>,
  ul: ({ children }) => <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-body text-ink-500">{children}</ul>,
  ol: ({ children }) => <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-body text-ink-500">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed marker:text-ink-300">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-800 underline underline-offset-2">
      {children}
    </a>
  ),
  hr: () => <hr className="my-8 border-line" />,
};

export function LegalContent({ markdown }: { markdown: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <ReactMarkdown components={components}>{markdown}</ReactMarkdown>
    </div>
  );
}
