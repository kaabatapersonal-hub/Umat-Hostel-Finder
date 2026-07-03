"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { LocateFixed, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LatLng } from "@/lib/geo";
import type { UserLocationStatus } from "@/hooks/use-user-location";

export interface LocateButtonProps {
  status: UserLocationStatus;
  position: LatLng | null;
  onLocate: () => void;
}

export function LocateButton({ status, position, onLocate }: LocateButtonProps) {
  const map = useMap();
  // Only fly to the user's position the moment a fresh fix arrives, not on
  // every re-render while it stays granted (e.g. after a pan/zoom).
  const flownToRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "granted" || !position) return;
    const key = `${position.lat},${position.lng}`;
    if (flownToRef.current === key) return;
    flownToRef.current = key;
    map.flyTo([position.lat, position.lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, [status, position, map]);

  return (
    <button
      type="button"
      aria-label="Locate me"
      onClick={onLocate}
      disabled={status === "loading"}
      className={cn(
        "flex size-11 items-center justify-center rounded-full bg-surface text-brand-800 shadow-md transition-opacity",
        status === "loading" && "opacity-70"
      )}
    >
      {status === "loading" ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <LocateFixed className={cn("size-5", status === "granted" && "text-brand-600")} />
      )}
    </button>
  );
}
