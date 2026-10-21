"use client";

import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { pinIcon } from "./markerIcon";
import type { Venue } from "@/lib/types";

export default function MapViewClient({ venue }: { venue: Venue }) {
  return (
    <div className="h-[240px] overflow-hidden rounded-2xl border-2 border-ink">
      <MapContainer
        center={[venue.lat, venue.lng]}
        zoom={15}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Marker position={[venue.lat, venue.lng]} icon={pinIcon} />
      </MapContainer>
    </div>
  );
}
