"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import { hostelMarkerIcon } from "./hostel-marker-icon";
import { HostelPopupContent } from "./hostel-popup-content";
import { UMAT_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from "@/lib/map-constants";
import type { MapHostelPin } from "@/lib/queries/map-hostels";

export interface HostelMapProps {
  hostels: MapHostelPin[];
}

// This whole module touches `window` (Leaflet) and must never be part of
// the server render -- it's only ever reached via next/dynamic with
// `ssr: false` from app/map/page.tsx. Real coordinates only, no dispersion:
// a pin here is a claim about where a hostel actually is.
export default function HostelMap({ hostels }: HostelMapProps) {
  return (
    <MapContainer
      center={UMAT_CENTER}
      zoom={DEFAULT_ZOOM}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      scrollWheelZoom
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
            position={[hostel.latitude, hostel.longitude]}
            icon={hostelMarkerIcon(hostel.isActivelyFeatured)}
          >
            <Popup minWidth={176}>
              <HostelPopupContent hostel={hostel} />
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
