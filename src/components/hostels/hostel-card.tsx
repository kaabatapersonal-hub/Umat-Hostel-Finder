"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, Clock, Star, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceTag } from "@/components/ui/price-tag";
import type { HostelCard as HostelCardData } from "@/lib/queries/hostels";

const AVAILABILITY_CONFIG: Record<string, { label: string; variant: "available" | "filling" | "full" }> = {
  available: { label: "Available", variant: "available" },
  filling: { label: "Filling Up", variant: "filling" },
  full: { label: "Full", variant: "full" },
};

export interface HostelCardProps {
  hostel: HostelCardData;
  index?: number;
  // Content already present in the first paint (SSR/ISR HTML) must render
  // visible immediately — a mount-triggered fade-in would otherwise leave it
  // at opacity:0 until JS hydrates, which on a throttled connection can take
  // seconds. Only cards that appear *after* hydration (pagination, search/
  // filter changes) should get the entrance animation.
  animateIn?: boolean;
}

export function HostelCard({ hostel, index = 0, animateIn = true }: HostelCardProps) {
  const thumbnail = hostel.images[0];
  const availability = AVAILABILITY_CONFIG[hostel.availability] ?? AVAILABILITY_CONFIG.available;
  const visibleTags = hostel.tags.slice(0, 3);
  const extraTagCount = hostel.tags.length - visibleTags.length;

  return (
    <motion.div
      initial={animateIn ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 10) * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/hostel/${hostel.id}`} className="block">
        <Card interactive className="h-full">
          <div className="relative aspect-video w-full bg-brand-50">
            {thumbnail ? (
              <Image
                src={thumbnail}
                alt={hostel.name}
                fill
                sizes="(min-width: 640px) 50vw, 100vw"
                className="object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Building2 className="size-10 text-brand-800/40" strokeWidth={1.5} />
              </div>
            )}

            <div className="absolute right-3 top-3">
              <PriceTag amount={hostel.price} />
            </div>

            <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
              <Badge variant={availability.variant} size="sm">
                {availability.label}
              </Badge>
              {hostel.isActivelyFeatured && (
                <Badge variant="featured" size="sm">
                  Featured
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 p-4">
            <h3 className="font-display text-h1 text-ink-900 line-clamp-1">{hostel.name}</h3>

            <div className="flex items-center gap-3 text-body-sm text-ink-500">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5 shrink-0" />
                <span className="line-clamp-1">{hostel.location}</span>
              </span>
              {hostel.distanceText && (
                <span className="flex shrink-0 items-center gap-1">
                  <Clock className="size-3.5 shrink-0" />
                  {hostel.distanceText}
                </span>
              )}
            </div>

            {hostel.ratingCount > 0 && (
              <div className="flex items-center gap-1 text-body-sm text-ink-900">
                <Star className="size-3.5 fill-gold-500 text-gold-500" />
                <span className="font-medium">{hostel.ratingAvg.toFixed(1)}</span>
                <span className="text-ink-500">({hostel.ratingCount})</span>
              </div>
            )}

            {visibleTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {visibleTags.map((tag) => (
                  <Badge key={tag} variant="neutral" size="sm">
                    {tag}
                  </Badge>
                ))}
                {extraTagCount > 0 && (
                  <Badge variant="neutral" size="sm">
                    +{extraTagCount}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
