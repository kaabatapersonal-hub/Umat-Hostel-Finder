"use client";

import { useEffect, useState } from "react";
import { Home, Heart, Search } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/ui/price-tag";
import { Skeleton, SkeletonLine, SkeletonCard } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SmartImage } from "@/components/ui/smart-image";
import { ImageUploader } from "@/components/ui/image-uploader";
import { createClient } from "@/lib/supabase/client";
import type { UploadedImage } from "@/lib/images";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="label text-label text-brand-800">{title}</h2>
      {children}
    </section>
  );
}

// Storage RLS requires an authenticated caller for uploads (Session 2), but
// real auth doesn't land until Session 6 — this is a throwaway sign-in
// form so the real upload -> Storage path can be exercised now. Delete this
// whole section once Session 6 ships and Session 8 wires ImageUploader into
// the real submit form.
function ImagePipelineTestSection() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-ink-500">
        Uploads require an authenticated session (Storage RLS is authenticated-write). Sign in with any test
        user created in Supabase Auth — this form is throwaway, real auth is Session 6.
      </p>

      {session ? (
        <div className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2">
          <span className="text-body-sm text-ink-900">Signed in as {session.user.email}</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSignIn} className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="test user email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="sm:w-56"
          />
          <Input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="sm:w-40"
          />
          <Button type="submit">Sign in</Button>
        </form>
      )}
      {authError && <p className="text-body-sm text-danger">{authError}</p>}

      {session && (
        <ImageUploader bucket="hostel-images" value={images} onChange={setImages} maxFiles={5} label="Test photos" />
      )}

      {images.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="label text-label text-ink-500">Resulting UploadedImage[]</span>
          {images.map((img) => (
            <div key={img.url} className="flex items-center gap-3">
              <SmartImage src={img.url} blurDataURL={img.blurDataURL} alt="" className="size-16 shrink-0 rounded-md" />
              <code className="break-all text-caption text-ink-500">{img.url}</code>
            </div>
          ))}
        </div>
      )}
    </div>
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
        <div className="flex flex-wrap items-center gap-3">
          <PriceTag amount={2200} />
          <PriceTag amount={1800} max={3200} />
        </div>
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

      <Section title="SmartImage (blur-up + branded fallback)">
        <div className="grid grid-cols-3 gap-3">
          <SmartImage
            src="https://ebdmqflfnsqpaujhezgw.supabase.co/storage/v1/object/public/hostel-images/c8479823-755d-41e4-b51e-7ac1807561a9.webp"
            blurDataURL="data:image/webp;base64,UklGRqQCAABXRUJQVlA4WAoAAAAgAAAAEwAADAAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggtgAAADAFAJ0BKhQADQA+0VSjS6gkoyGwCAEAGglsAJ0yhHAV+rdwH6AEFiLHYRZJOauduawAAP7jwLSPsjJ2Yw34hqreobUW3GbWhwGh5bjHFagk/p4OVr1+U3/ehdvs5nJkw28przx+urBAXqc17tt7ZZR/tR9iNkmD/ErbxdGYlyunFfoCFO+8AR4/VNQl4+ImC+nXcK6/ZORg3/fr9ZwcQ/0Hws2i70ft0xAe0F7V1wA/7/pEWwAA"
            alt="Example"
            className="aspect-square rounded-md"
          />
          <SmartImage src={null} alt="No image" className="aspect-square rounded-md" />
          <SmartImage
            src="https://ebdmqflfnsqpaujhezgw.supabase.co/storage/v1/object/public/hostel-images/does-not-exist.webp"
            alt="Broken URL (real Storage 404)"
            className="aspect-square rounded-md"
          />
        </div>
      </Section>

      <Section title="Image pipeline (dev test — compress, blur, upload)">
        <ImagePipelineTestSection />
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
