"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, AlertCircle } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useGifSearch } from "@/hooks/use-gif-search";
import type { GifResult } from "@/lib/queries/gifs";

export interface GifPickerSheetProps {
  open: boolean;
  onClose: () => void;
  onSelect: (gif: GifResult) => void;
}

// Opens to Klipy's trending set, switches to search results once the
// student types -- same debounced-search shape as the marketplace feed's
// own search box. Tapping a result sends it immediately (Discord/Slack-
// style); this sheet never has a separate "send" step of its own.
export function GifPickerSheet({ open, onClose, onSelect }: GifPickerSheetProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: gifs, isPending, isError, refetch } = useGifSearch(debouncedQuery, open);

  function handleSelect(gif: GifResult) {
    onSelect(gif);
    setQuery("");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Send a GIF" className="flex max-h-[80vh] flex-col">
      <div className="mb-3 flex h-11 shrink-0 items-center gap-2.5 rounded-md bg-surface-muted px-3.5">
        <Search className="size-4 shrink-0 text-ink-300" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs..."
          aria-label="Search GIFs"
          className="w-full bg-transparent text-body text-ink-900 placeholder:text-ink-300 focus:outline-none"
        />
      </div>

      <div className="overflow-y-auto">
        {isPending ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
            title="Couldn't load GIFs"
            description="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        ) : !gifs || gifs.length === 0 ? (
          <p className="py-8 text-center text-body-sm text-ink-300">No GIFs found -- try a different search.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                aria-label={`Send GIF: ${gif.title}`}
                onClick={() => handleSelect(gif)}
                className="relative aspect-square w-full overflow-hidden rounded-md bg-surface-muted"
              >
                <Image src={gif.previewUrl} alt={gif.title} fill unoptimized sizes="33vw" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
