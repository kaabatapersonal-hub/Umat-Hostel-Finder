"use client";

import { useCallback, useState } from "react";
import type { LatLng } from "@/lib/geo";

export type UserLocationStatus = "idle" | "loading" | "granted" | "denied" | "unavailable";

export interface UserLocationState {
  position: LatLng | null;
  accuracy: number | null;
  status: UserLocationStatus;
  message: string | null;
}

// Wraps the browser Geolocation API for the map's "Locate me" (Session
// 9.5). Never called automatically -- the map must be fully usable with
// location untouched, so this only fires on an explicit user tap
// (locate()), and a denial/failure is just state, never a thrown error
// that could break the page.
export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>({
    position: null,
    accuracy: null,
    status: "idle",
    message: null,
  });

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ position: null, accuracy: null, status: "unavailable", message: "Location isn't available on this device or browser." });
      return;
    }

    setState((prev) => ({ ...prev, status: "loading", message: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          position: { lat: position.coords.latitude, lng: position.coords.longitude },
          accuracy: position.coords.accuracy,
          status: "granted",
          message: null,
        });
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        setState({
          position: null,
          accuracy: null,
          status: denied ? "denied" : "unavailable",
          message: denied
            ? "Location off — you can still browse the map."
            : "Couldn't get your location right now.",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, []);

  const clear = useCallback(() => {
    setState({ position: null, accuracy: null, status: "idle", message: null });
  }, []);

  return { ...state, locate, clear };
}
