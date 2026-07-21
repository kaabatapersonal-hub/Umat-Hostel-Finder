import type { Metadata } from "next";
import { getCachedLandingStats } from "@/lib/queries/landing-stats-cached";
import { AboutHeader } from "@/components/about/about-header";
import { AboutHero } from "@/components/about/about-hero";
import { StatsStrip } from "@/components/about/stats-strip";
import { HowItWorks } from "@/components/about/how-it-works";
import { FeatureShowcase } from "@/components/about/feature-showcase";
import { ManagersSection } from "@/components/about/managers-section";
import { TrustSection } from "@/components/about/trust-section";
import { FaqSection } from "@/components/about/faq-section";
import { AboutFooter } from "@/components/about/about-footer";

// Mostly static content + an hourly-cached stats query -- statically
// generated and revalidated on this cadence, never rendered per-request.
export const revalidate = 3600;

const title = "Campa — Find student hostels in Tarkwa";
const description =
  "Browse hostels near UMaT with real photos, prices per room type, live availability, and direct WhatsApp contact with managers. Free for students. Hostel managers list for free too.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  // openGraph/twitter don't inherit title/description from the parent's
  // own top-level fields -- without redeclaring them here, a WhatsApp/
  // Twitter share of /about would show the generic app description
  // instead of this page's own pitch. The image itself is inherited from
  // the root opengraph-image route, which is the intended reuse.
  openGraph: { title, description },
  twitter: { title, description },
};

export default async function AboutPage() {
  let stats;
  try {
    stats = await getCachedLandingStats();
  } catch {
    // A vanity stats strip failing to load is not worth breaking the
    // whole marketing page over -- just omit the section.
    stats = null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <AboutHeader />
      <main className="flex-1">
        <AboutHero />
        {stats && <StatsStrip stats={stats} />}
        <HowItWorks />
        <FeatureShowcase />
        <ManagersSection />
        <TrustSection />
        <FaqSection />
      </main>
      <AboutFooter />
    </div>
  );
}
