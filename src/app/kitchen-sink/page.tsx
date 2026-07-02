"use client";

import { useState } from "react";
import { Home, Heart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/ui/price-tag";
import { Skeleton, SkeletonLine, SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="label text-label text-brand-800">{title}</h2>
      {children}
    </section>
  );
}

export default function KitchenSinkPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col gap-10 px-4 py-8">
      <div>
        <p className="label text-label text-gold-600">Internal / dev only</p>
        <h1 className="font-display text-display-lg text-ink-900">Kitchen Sink</h1>
        <p className="text-body text-ink-500">
          Delete this page before launch. Preview of every base component.
        </p>
      </div>

      <Section title="Type scale">
        <div className="flex flex-col gap-2">
          <p className="font-display text-display-lg text-ink-900">Display LG · Sora 700</p>
          <p className="font-display text-display text-ink-900">Display · Sora 700</p>
          <p className="font-display text-h1 text-ink-900">H1 · Sora 700</p>
          <p className="font-display text-h2 text-ink-900">H2 · Sora 600</p>
          <p className="text-body text-ink-900">Body · Inter 400</p>
          <p className="text-body-strong text-ink-900">Body strong · Inter 600</p>
          <p className="text-body-sm text-ink-500">Body sm · Inter 400</p>
          <p className="text-caption text-ink-500">Caption · Inter 500</p>
          <p className="label text-label text-ink-500">Label · Inter 600</p>
        </div>
      </Section>

      <Section title="Colors">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            ["brand-900", "bg-brand-900"],
            ["brand-800", "bg-brand-800"],
            ["brand-600", "bg-brand-600"],
            ["brand-50", "bg-brand-50"],
            ["gold-500", "bg-gold-500"],
            ["gold-600", "bg-gold-600"],
            ["gold-50", "bg-gold-50"],
            ["ink-900", "bg-ink-900"],
            ["ink-500", "bg-ink-500"],
            ["ink-300", "bg-ink-300"],
            ["success", "bg-success"],
            ["warning", "bg-warning"],
            ["danger", "bg-danger"],
          ].map(([label, cls]) => (
            <div key={label} className="flex flex-col gap-1.5">
              <div className={`h-12 w-full rounded-md ${cls} shadow-sm`} />
              <span className="text-caption text-ink-500">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="primary" size="md">
            Medium
          </Button>
          <Button variant="primary" size="lg">
            Large
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="accent" loading={loading} onClick={() => setLoading((v) => !v)}>
            {loading ? "Loading..." : "Toggle loading"}
          </Button>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-body text-ink-900">Static card</p>
          </Card>
          <Card interactive className="p-4">
            <p className="text-body text-ink-900">Interactive card (hover / tap)</p>
          </Card>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Hostel name" placeholder="e.g. Green Valley Hostel" />
          <Input label="Price" placeholder="GHS" error="Enter a valid amount" />
          <Textarea
            label="Description"
            placeholder="Describe the hostel..."
            helperText="Max 500 characters"
          />
        </div>
      </Section>

      <Section title="Badges / Chips">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="featured">Featured</Badge>
          <Badge variant="available">Available</Badge>
          <Badge variant="filling">Filling Up</Badge>
          <Badge variant="full">Full</Badge>
          <Badge variant="neutral">Neutral</Badge>
        </div>
      </Section>

      <Section title="Price tag">
        <PriceTag amount={2200} />
      </Section>

      <Section title="Skeletons">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <SkeletonLine className="w-2/3" />
          <SkeletonCard className="max-w-xs" />
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState
          icon={<Heart className="size-7" strokeWidth={1.75} />}
          title="No saved hostels yet"
          description="Tap the heart on any hostel to keep it here for later."
          actionLabel="Browse hostels"
          onAction={() => {}}
          className="bg-surface shadow-card"
        />
      </Section>

      <Section title="Icons">
        <div className="flex items-center gap-4 text-brand-800">
          <Home className="size-6" />
          <Search className="size-6" />
          <Heart className="size-6" />
        </div>
      </Section>
    </div>
  );
}
