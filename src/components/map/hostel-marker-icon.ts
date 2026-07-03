import L from "leaflet";

// A branded teardrop pin instead of Leaflet's default blue marker (and its
// notorious broken-image-path problem in bundlers) -- built as raw SVG via
// divIcon so there's no marker-icon.png asset to wire up at all. Colors
// reference the app's CSS custom properties directly (--brand-800 /
// --gold-500) rather than duplicating hex values, so this stays in sync
// with the theme automatically.
function pinSvg(color: string): string {
  return `
    <svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 3px rgba(16,33,28,0.35))">
      <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 23 15 23s15-12.5 15-23C30 6.716 23.284 0 15 0z" fill="${color}"/>
      <circle cx="15" cy="15" r="5.5" fill="white"/>
    </svg>
  `;
}

const regularIcon = L.divIcon({
  className: "",
  html: pinSvg("var(--brand-800)"),
  iconSize: [30, 38],
  iconAnchor: [15, 38],
  popupAnchor: [0, -36],
});

const featuredIcon = L.divIcon({
  className: "",
  html: pinSvg("var(--gold-500)"),
  iconSize: [30, 38],
  iconAnchor: [15, 38],
  popupAnchor: [0, -36],
});

export function hostelMarkerIcon(isFeatured: boolean): L.DivIcon {
  return isFeatured ? featuredIcon : regularIcon;
}
