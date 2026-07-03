import { Circle, CircleMarker } from "react-leaflet";
import type { LatLng } from "@/lib/geo";

export interface UserLocationMarkerProps {
  position: LatLng;
  accuracy: number | null;
}

// The familiar "blue dot" convention -- visually distinct from the
// brand-colored hostel pins on purpose, so it's never mistaken for a
// listing. The halo communicates "approximately here," not a precise GPS
// fix (accuracy is often 20-100m on a phone).
export function UserLocationMarker({ position, accuracy }: UserLocationMarkerProps) {
  const center: [number, number] = [position.lat, position.lng];

  return (
    <>
      {accuracy != null && accuracy > 0 && (
        <Circle
          center={center}
          radius={accuracy}
          pathOptions={{ color: "#4285F4", fillColor: "#4285F4", fillOpacity: 0.12, weight: 1, opacity: 0.3 }}
        />
      )}
      <CircleMarker
        center={center}
        radius={7}
        pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#4285F4", fillOpacity: 1 }}
      />
    </>
  );
}
