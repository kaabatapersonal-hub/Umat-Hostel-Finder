import { getInitials, formatRelativeTime, formatCompactCount } from "@/lib/utils";
import type { BuzzPost } from "@/lib/queries/buzz";

export interface BuzzPostExportCardProps {
  post: BuzzPost;
  isAuthorVerified?: boolean;
}

// A clean, non-interactive rendering of a post, captured with html2canvas
// for the "save as image" action (see use-save-buzz-post-image.ts) --
// deliberately NOT the same markup as BuzzPostCard: no action buttons, a
// plain white background, generous padding, and a Campa-branded footer,
// since this is meant to be shared to WhatsApp status / Instagram stories
// as a standalone image, not a screenshot of the app chrome. Fixed at
// 1080px wide (standard phone-screenshot width); height is whatever the
// content needs.
export function BuzzPostExportCard({ post, isAuthorVerified = false }: BuzzPostExportCardProps) {
  return (
    <div style={{ width: 1080, fontFamily: "var(--font-sans, sans-serif)", background: "#ffffff" }}>
      <div style={{ padding: "64px 64px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "#EAF3EF",
              color: "#0E4A34",
              fontFamily: "var(--font-display, serif)",
              fontSize: 36,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {getInitials(post.authorName, null)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 34, fontWeight: 700, color: "#101828" }}>{post.authorName || "Student"}</span>
              {isAuthorVerified && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "#0E4A34",
                    color: "#fff",
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ✓
                </span>
              )}
            </div>
            <span style={{ fontSize: 26, color: "#667085" }}>{formatRelativeTime(post.createdAt)}</span>
          </div>
        </div>

        <p
          style={{
            marginTop: 48,
            fontSize: 40,
            lineHeight: 1.45,
            color: "#101828",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {post.content}
        </p>

        <div style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 32, fontSize: 28, color: "#667085" }}>
          <span>🔥 {formatCompactCount(post.likeCount)}</span>
          <span>👁 {formatCompactCount(post.viewCount)}</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "28px 64px",
          background: "#0E4A34",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- html2canvas
            captures a detached, off-screen DOM tree; next/image's lazy
            loading and srcset negotiation have no lifecycle to hook into
            there, so a plain img is the only thing that reliably paints
            before the canvas snapshot is taken. */}
        <img src="/icon-square.svg" alt="" width={40} height={40} style={{ borderRadius: 8 }} />
        <span style={{ fontSize: 28, fontWeight: 600, color: "#ffffff", letterSpacing: 0.5 }}>campagh.app</span>
      </div>
    </div>
  );
}
