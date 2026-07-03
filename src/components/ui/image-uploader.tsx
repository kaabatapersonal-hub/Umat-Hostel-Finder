"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ImagePlus, X, RotateCcw, ChevronLeft, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { compressImageForUpload } from "@/lib/image-compression";
import { uploadImageToStorage, deleteImageFromStorage, type StorageBucket } from "@/lib/storage-upload";
import type { UploadedImage } from "@/lib/images";

interface UploadSlot {
  key: string;
  status: "compressing" | "uploading" | "done" | "error";
  progress: number;
  previewUrl: string;
  file?: File;
  image?: UploadedImage;
  error?: string;
}

export interface ImageUploaderProps {
  bucket: StorageBucket;
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxFiles?: number;
  label?: string;
}

function slotsToImages(slots: UploadSlot[]): UploadedImage[] {
  return slots.filter((s): s is UploadSlot & { image: UploadedImage } => s.status === "done" && !!s.image).map((s) => s.image);
}

// Reusable compress-resize-upload component: shrinks + strips EXIF client
// side (see lib/image-compression.ts) before ever touching the network,
// uploads to Supabase Storage, and reports per-image progress/errors so one
// bad upload on a weak connection never loses the others.
export function ImageUploader({ bucket, value, onChange, maxFiles = 10, label = "Photos" }: ImageUploaderProps) {
  const [slots, setSlots] = useState<UploadSlot[]>(() =>
    value.map((image) => ({ key: image.url, status: "done", progress: 100, previewUrl: image.url, image }))
  );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Calling onChange (which triggers the parent's setState) from inside a
  // setSlots updater is a React anti-pattern — updater functions must be
  // pure, and React can invoke them outside a normal event-handler context.
  // Sync outward from an effect instead, keyed off the actual slots value.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current(slotsToImages(slots));
  }, [slots]);

  const doneCount = slots.filter((s) => s.status === "done").length;
  const remainingSlots = Math.max(0, maxFiles - slots.length);

  async function runUpload(key: string, file: File) {
    const supabase = createClient();

    try {
      setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, status: "compressing", progress: 0, error: undefined } : s)));

      const { file: compressed, blurDataURL } = await compressImageForUpload(file, (progress) => {
        setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, progress: Math.round(progress * 0.6) } : s)));
      });

      setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, status: "uploading", progress: 65 } : s)));

      // No native byte-level progress from supabase-js's upload() (it's a
      // plain fetch POST) — nudge the bar while we wait so it doesn't look
      // stalled, then snap to 100 on completion.
      const ticker = setInterval(() => {
        setSlots((prev) =>
          prev.map((s) => (s.key === key && s.status === "uploading" && s.progress < 95 ? { ...s, progress: s.progress + 3 } : s))
        );
      }, 200);

      let url: string;
      try {
        url = await uploadImageToStorage(supabase, bucket, compressed);
      } finally {
        clearInterval(ticker);
      }

      const image: UploadedImage = { url, blurDataURL };
      setSlots((prev) =>
        prev.map((s) => (s.key === key ? { ...s, status: "done" as const, progress: 100, previewUrl: url, image } : s))
      );
    } catch (err) {
      setSlots((prev) =>
        prev.map((s) =>
          s.key === key
            ? { ...s, status: "error", error: err instanceof Error ? err.message : "Upload failed" }
            : s
        )
      );
    }
  }

  function addFiles(files: FileList | File[]) {
    const list = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, remainingSlots);

    for (const file of list) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);
      setSlots((prev) => [...prev, { key, status: "compressing", progress: 0, previewUrl, file }]);
      void runUpload(key, file);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function removeSlot(key: string) {
    const slot = slots.find((s) => s.key === key);
    setSlots((prev) => prev.filter((s) => s.key !== key));

    // The main fix for Session 5's tracked orphan-cleanup loose end: a
    // slot that finished uploading has a real Storage object behind it, so
    // removing it from the form must also delete it, not just drop it from
    // the array. Best-effort -- a failed delete here just leaves an
    // orphan, same as the already-accepted abandon-mid-form case.
    if (slot?.status === "done" && slot.image) {
      const supabase = createClient();
      void deleteImageFromStorage(supabase, bucket, slot.image.url).catch(() => {});
    }
  }

  function retrySlot(key: string) {
    const slot = slots.find((s) => s.key === key);
    if (slot?.file) void runUpload(key, slot.file);
  }

  function moveSlot(key: string, direction: -1 | 1) {
    setSlots((prev) => {
      const index = prev.findIndex((s) => s.key === key);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="label text-label text-ink-500">{label}</span>
        <span className="text-caption text-ink-300">
          {doneCount}/{maxFiles}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => remainingSlots > 0 && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors",
          remainingSlots > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-50",
          isDragOver ? "border-brand-600 bg-brand-50" : "border-line bg-surface-muted"
        )}
      >
        <ImagePlus className="size-6 text-brand-800" strokeWidth={1.5} />
        <p className="text-body-sm text-ink-500">
          {remainingSlots > 0 ? "Tap to add photos, or drag and drop" : "Photo limit reached"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
          disabled={remainingSlots === 0}
        />
      </div>

      {slots.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {slots.map((slot, i) => (
            <motion.div
              key={slot.key}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="relative aspect-square overflow-hidden rounded-md bg-brand-50"
            >
              <Image src={slot.previewUrl} alt="" fill sizes="25vw" className="object-cover" unoptimized />

              {slot.status !== "done" && slot.status !== "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink-900/50 text-white">
                  <Loader2 className="size-5 animate-spin" />
                  <span className="text-caption">{slot.progress}%</span>
                </div>
              )}

              {slot.status === "error" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-danger/80 p-2 text-center text-white">
                  <AlertCircle className="size-5" />
                  <button
                    type="button"
                    onClick={() => retrySlot(slot.key)}
                    aria-label="Retry upload"
                    className="flex items-center gap-1 rounded-pill bg-white/20 px-2 py-1 text-caption"
                  >
                    <RotateCcw className="size-3" />
                    Retry
                  </button>
                </div>
              )}

              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => removeSlot(slot.key)}
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-ink-900/60 text-white"
              >
                <X className="size-3.5" />
              </button>

              {slots.length > 1 && (
                <div className="absolute bottom-1 left-1 flex gap-1">
                  {i > 0 && (
                    <button
                      type="button"
                      aria-label="Move earlier"
                      onClick={() => moveSlot(slot.key, -1)}
                      className="flex size-6 items-center justify-center rounded-full bg-ink-900/60 text-white"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                  )}
                  {i < slots.length - 1 && (
                    <button
                      type="button"
                      aria-label="Move later"
                      onClick={() => moveSlot(slot.key, 1)}
                      className="flex size-6 items-center justify-center rounded-full bg-ink-900/60 text-white"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  )}
                </div>
              )}

              {i === 0 && slot.status === "done" && (
                <span className="absolute bottom-1 right-1 rounded-pill bg-gold-500 px-1.5 py-0.5 text-[10px] font-semibold text-ink-900">
                  Cover
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
