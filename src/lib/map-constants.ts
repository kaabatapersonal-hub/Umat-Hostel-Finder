// UMaT campus, Tarkwa — the map's default center. From the platform doc.
export const UMAT_CENTER: [number, number] = [5.3043, -1.9942];

export const DEFAULT_ZOOM = 15;
// This is a general-purpose map of campus and Tarkwa, not a hostel-pin
// viewer that happens to have a basemap under it -- students should be
// able to zoom out far enough to navigate the whole town, not just the
// immediate hostel clusters around campus. Still bounded well short of
// the whole country/world (that'd just waste tile requests on a weak
// connection for a view nobody needs). MAX_ZOOM matches the CARTO tile
// layer's own maxZoom (see hostel-map.tsx) rather than capping below it.
export const MIN_ZOOM = 11;
export const MAX_ZOOM = 20;
