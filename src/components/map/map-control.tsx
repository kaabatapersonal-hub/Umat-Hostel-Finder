"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import { useMap } from "react-leaflet";

export interface MapControlProps {
  position: L.ControlPosition;
  children: ReactNode;
}

// A real Leaflet control (not just an absolutely-positioned div), so
// custom buttons like "Locate me" stack correctly in their corner
// alongside Leaflet's own zoom control instead of needing hand-tuned pixel
// offsets, and don't fight the map for taps/scroll underneath them.
//
// Deliberately a useEffect (with real cleanup), not a useState lazy
// initializer -- a lazy initializer's side effects (control.addTo(map))
// run under React Strict Mode's double-invocation in dev with no
// corresponding cleanup for the discarded first call, which orphans a
// control and leaves the portal target empty. An effect's mount/cleanup
// pair handles Strict Mode's mount->cleanup->mount dance correctly, so
// exactly one control ever ends up attached.
export function MapControl({ position, children }: MapControlProps) {
  const map = useMap();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const control = new L.Control({ position });
    control.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-control");
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      return div;
    };
    control.addTo(map);
    setContainer(control.getContainer() ?? null);

    return () => {
      control.remove();
    };
  }, [map, position]);

  if (!container) return null;
  return createPortal(children, container);
}
