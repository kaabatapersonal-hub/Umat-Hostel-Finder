// Location-tool math shared across the details page and the map (Session
// 9.5). Every distance here is straight-line (haversine), never a routed
// distance — that's why every consumer must label it "~" / "approximate"
// and hand off to Google Maps (buildDirectionsLink) for anything resembling
// real directions.

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const WALK_SPEED_KMH = 5;

export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function walkTimeMinutes(km: number): number {
  return Math.max(1, Math.round((km / WALK_SPEED_KMH) * 60));
}

// "~12 min walk" / "~1h 20m walk" — always prefixed with "~", never framed
// as a real route (straight-line distance under-counts actual walking time
// on real roads/paths).
export function formatWalkTime(km: number): string {
  const mins = walkTimeMinutes(km);
  if (mins < 60) return `~${mins} min walk`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `~${hrs}h${rem > 0 ? ` ${rem}m` : ""} walk`;
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// Google Maps figures out the user's current location as the origin
// automatically when none is given; passing one explicitly (once we have
// it via useUserLocation) makes the handoff a little more precise. This is
// the entire "navigation" story on purpose — no routing code of our own.
export function buildDirectionsLink(destination: LatLng, origin?: LatLng): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
  });
  if (origin) params.set("origin", `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
