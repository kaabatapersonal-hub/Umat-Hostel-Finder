"use client";

import { useEffect, useRef, useState } from "react";
import type L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline, ZoomControl, useMap, useMapEvent } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import { hostelMarkerIcon, customPointIcon } from "./hostel-marker-icon";
import { HostelPopupContent } from "./hostel-popup-content";
import { MapControl } from "./map-control";
import { LocateButton } from "./locate-button";
import { NearHereButton } from "./near-here-button";
import { UserLocationMarker } from "./user-location-marker";
import { UMAT_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from "@/lib/map-constants";
import type { LatLng } from "@/lib/geo";
import type { MapHostelPin } from "@/lib/queries/map-hostels";
import type { UserLocationStatus } from "@/hooks/use-user-location";

export interface HostelMapProps {
  hostels: MapHostelPin[];
  // Feature 7: opened from "View on map" on a specific hostel card -- fly
  // to it and pop its popup open automatically.
  focusHostelId?: string | null;
  userPosition: LatLng | null;
  userAccuracy: number | null;
  userStatus: UserLocationStatus;
  onLocate: () => void;
}

// Flies to + auto-opens a specific hostel's popup once, when the map is
// opened from a "View on map" link elsewhere in the app (feature 7).
// Module-level (not defined inside HostelMap) so it isn't recreated as a
// new component type on every render.
function FocusController({
  focusHostelId,
  hostels,
  markerRefs,
}: {
  focusHostelId?: string | null;
  hostels: MapHostelPin[];
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusHostelId) return;
    const hostel = hostels.find((h) => h.id === focusHostelId);
    if (!hostel) return;

    map.flyTo([hostel.latitude, hostel.longitude], 17, { duration: 0.8 });
    const timer = setTimeout(() => markerRefs.current.get(focusHostelId)?.openPopup(), 900);
    return () => clearTimeout(timer);
    // Only re-run when the target id changes, not on every hostels refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusHostelId]);

  return null;
}

// Arms/disarms "drop a pin" mode and reports the tap -- a plain click
// handler, not a component with visible UI of its own.
function MapClickHandler({ enabled, onPick }: { enabled: boolean; onPick: (point: LatLng) => void }) {
  useMapEvent("click", (e) => {
    if (!enabled) return;
    onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
  });
  return null;
}

// This whole module touches `window` (Leaflet) and must never be part of
// the server render -- it's only ever reached via next/dynamic with
// `ssr: false` from app/map/page.tsx. Real coordinates only, no dispersion:
// a pin here is a claim about where a hostel actually is.
export default function HostelMap({
  hostels,
  focusHostelId,
  userPosition,
  userAccuracy,
  userStatus,
  onLocate,
}: HostelMapProps) {
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());
  const [activeHostelId, setActiveHostelId] = useState<string | null>(null);

  // Feature 6: "near here" custom point. Armed = next map tap drops it.
  const [customPointArmed, setCustomPointArmed] = useState(false);
  const [customPoint, setCustomPoint] = useState<LatLng | null>(null);

  const activeHostel = hostels.find((h) => h.id === activeHostelId) ?? null;

  return (
    <MapContainer
      center={UMAT_CENTER}
      zoom={DEFAULT_ZOOM}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      scrollWheelZoom
      zoomControl={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MarkerClusterGroup chunkedLoading>
        {hostels.map((hostel) => (
          <Marker
            key={hostel.id}
            ref={(marker) => {
              if (marker) markerRefs.current.set(hostel.id, marker);
              else markerRefs.current.delete(hostel.id);
            }}
            position={[hostel.latitude, hostel.longitude]}
            icon={hostelMarkerIcon(hostel.isActivelyFeatured)}
            eventHandlers={{
              popupopen: () => setActiveHostelId(hostel.id),
              popupclose: () => setActiveHostelId((current) => (current === hostel.id ? null : current)),
            }}
          >
            <Popup minWidth={176}>
              <HostelPopupContent hostel={hostel} userPosition={userPosition} customPoint={customPoint} />
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>

      {userPosition && <UserLocationMarker position={userPosition} accuracy={userAccuracy} />}

      {customPoint && <Marker position={[customPoint.lat, customPoint.lng]} icon={customPointIcon} />}

      {/* "As the crow flies" only -- clearly styled as a straight guide
          line, never mistaken for a routed path. */}
      {userPosition && activeHostel && (
        <Polyline
          positions={[
            [userPosition.lat, userPosition.lng],
            [activeHostel.latitude, activeHostel.longitude],
          ]}
          pathOptions={{ color: "var(--ink-500)", weight: 2, dashArray: "2 8", opacity: 0.6 }}
        />
      )}

      <MapClickHandler
        enabled={customPointArmed}
        onPick={(point) => {
          setCustomPoint(point);
          setCustomPointArmed(false);
        }}
      />

      <FocusController focusHostelId={focusHostelId} hostels={hostels} markerRefs={markerRefs} />

      {/* Leaflet stacks same-corner controls in the order they're added to
          the map, first-added ending up topmost -- these two must come
          before ZoomControl in JSX so "Locate me" / "Near here" render
          above the zoom buttons, not below them. */}
      <MapControl position="bottomright">
        <div className="flex flex-col gap-2">
          <LocateButton status={userStatus} position={userPosition} onLocate={onLocate} />
          <NearHereButton
            armed={customPointArmed}
            active={!!customPoint}
            onToggleArm={() => setCustomPointArmed((armed) => !armed)}
            onClear={() => setCustomPoint(null)}
          />
        </div>
      </MapControl>
      <ZoomControl position="bottomright" />
    </MapContainer>
  );
}
