"use client";

import dynamic from "next/dynamic";
import type { Venue } from "@/lib/types";

const MapViewClient = dynamic(() => import("./MapView.client"), {
  ssr: false,
  loading: () => (
    <div className="h-[240px] animate-pulse rounded-2xl border-2 border-line-strong bg-line/40" />
  ),
});

export function MapView({ venue }: { venue: Venue }) {
  const q = encodeURIComponent(`${venue.name} ${venue.address}`);
  return (
    <div className="space-y-2">
      <MapViewClient venue={venue} />
      <p className="text-xs text-muted">{venue.address}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <a
          className="font-bold text-grape-ink underline underline-offset-2"
          href={`https://www.openstreetmap.org/?mlat=${venue.lat}&mlon=${venue.lng}#map=17/${venue.lat}/${venue.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          Open in OpenStreetMap
        </a>
        <a
          className="font-bold text-grape-ink underline underline-offset-2"
          href={`https://www.google.com/maps/search/?api=1&query=${q}`}
          target="_blank"
          rel="noreferrer"
        >
          Get directions
        </a>
      </div>
    </div>
  );
}
