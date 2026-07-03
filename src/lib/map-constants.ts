// UMaT campus, Tarkwa — the map's default center. From the platform doc.
export const UMAT_CENTER: [number, number] = [5.3043, -1.9942];

export const DEFAULT_ZOOM = 15;
// Campus + surrounding hostel clusters, never the whole country/world —
// keeps tile requests bounded on a weak connection.
export const MIN_ZOOM = 13;
export const MAX_ZOOM = 18;
