"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number | null, longitude: number | null) => void;
}

// V1 GPS capture: a browser geolocation button plus plain lat/lng inputs to
// paste or fine-tune coordinates. A full pin-drop map is Session 9's job
// (react-leaflet isn't installed yet) -- this is deliberately the simplest
// thing that gets real coordinates into the database, and it's entirely
// skippable (admin can add them on approval).
export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setError("Location isn't available on this device or browser.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange(position.coords.latitude, position.coords.longitude);
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location -- you can enter coordinates manually below.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={useCurrentLocation}
        loading={locating}
        className="self-start"
      >
        <MapPin className="size-4" />
        Use my current location
      </Button>

      {error && <p className="text-body-sm text-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Latitude"
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="5.3018"
          value={latitude ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value), longitude)}
        />
        <Input
          label="Longitude"
          type="number"
          inputMode="decimal"
          step="any"
          placeholder="-1.9878"
          value={longitude ?? ""}
          onChange={(e) => onChange(latitude, e.target.value === "" ? null : Number(e.target.value))}
        />
      </div>

      <p className="text-caption text-ink-300">
        Optional — helps this hostel appear on the map. You can skip this and add it later.
      </p>
    </div>
  );
}
