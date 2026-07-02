import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const RELATIVE_TIME_UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "year", seconds: 31536000 },
  { unit: "month", seconds: 2592000 },
  { unit: "week", seconds: 604800 },
  { unit: "day", seconds: 86400 },
  { unit: "hour", seconds: 3600 },
  { unit: "minute", seconds: 60 },
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// "Updated 3 days ago" — the freshness signal on the details page. Falls
// back to "just now" for anything under a minute.
export function formatRelativeTime(isoDate: string, now: number = Date.now()): string {
  const diffSeconds = (new Date(isoDate).getTime() - now) / 1000;

  for (const { unit, seconds } of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return relativeTimeFormatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return "just now";
}

const STALE_THRESHOLD_DAYS = 21;

export function isStale(isoDate: string, now: number = Date.now()): boolean {
  const diffDays = (now - new Date(isoDate).getTime()) / 86400000;
  return diffDays > STALE_THRESHOLD_DAYS;
}
