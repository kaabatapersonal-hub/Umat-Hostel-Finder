"use client";

import { motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SkeletonCard } from "@/components/ui/skeleton";

const FILTER_CHIPS = ["Near Campus", "Under GHS 2,000", "Available Now", "Featured", "En-suite"];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <section className="bg-brand-800 px-4 pt-8 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-start justify-between gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <span className="label text-caption text-gold-500">UMaT · Tarkwa</span>
            <h1 className="font-display text-display-lg text-white">Find your next hostel</h1>
          </div>
          <Button variant="accent" size="sm" className="mt-1 shrink-0">
            Submit Hostel
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 flex items-center gap-2"
        >
          <div className="flex h-12 flex-1 items-center gap-2.5 rounded-md bg-surface px-3.5 shadow-card">
            <Search className="size-5 text-ink-300" />
            <span className="text-body text-ink-300">Search hostels, areas...</span>
          </div>
          <button
            type="button"
            aria-label="Filters"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface text-brand-800 shadow-card"
          >
            <SlidersHorizontal className="size-5" />
          </button>
        </motion.div>
      </section>

      <section className="flex gap-2 overflow-x-auto px-4 py-4">
        {FILTER_CHIPS.map((chip, i) => (
          <motion.div
            key={chip}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.06 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            <Badge
              variant="neutral"
              size="md"
              className="shrink-0 cursor-pointer border border-line bg-surface px-3.5 py-1 text-ink-500"
            >
              {chip}
            </Badge>
          </motion.div>
        ))}
      </section>

      <section className="flex flex-col gap-4 px-4 pb-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-h1 text-ink-900">Hostels near you</h2>
          <span className="text-body-sm text-ink-500">Coming Session 3</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
