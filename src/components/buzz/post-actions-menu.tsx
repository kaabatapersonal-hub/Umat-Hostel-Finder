"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PostActionItem {
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

// A minimal overflow menu -- there's no dropdown/popover primitive
// elsewhere in the app, so this is scoped narrowly to Buzz's moderation
// actions rather than introducing a new general-purpose one. Keeps
// delete/pin accessible but out of the way, per Session 17.5's ask: not a
// visible delete icon sitting on every card.
export function PostActionsMenu({ actions }: { actions: PostActionItem[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="More actions"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex size-7 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
      >
        <MoreVertical className="size-3.5" />
      </button>

      {open && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute right-0 top-8 z-10 min-w-32 overflow-hidden rounded-md bg-surface py-1 shadow-md"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                action.onClick();
              }}
              className={cn(
                "block w-full whitespace-nowrap px-3 py-2 text-left text-body-sm hover:bg-surface-muted",
                action.destructive ? "text-danger" : "text-ink-900"
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
