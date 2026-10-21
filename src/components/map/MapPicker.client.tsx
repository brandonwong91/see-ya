"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import { pinIcon } from "./markerIcon";
import type { Venue } from "@/lib/types";

interface GeoResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const FALLBACK_CENTER: [number, number] = [51.5074, -0.1278]; // London

export default function MapPickerClient({
  value,
  onChange,
}: {
  value: Venue | null;
  onChange: (v: Venue | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounced forward geocode.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(query.trim())}`,
        );
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  const pick = useCallback(
    (r: GeoResult, keepName = false) => {
      onChange({
        name: keepName && value?.name ? value.name : r.name,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
      });
      setOpen(false);
      setResults([]);
      setQuery("");
      mapRef.current?.flyTo([r.lat, r.lng], 15, {
        duration: 0.35,
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
    },
    [onChange, value?.name],
  );

  const reverse = useCallback(
    async (lat: number, lng: number) => {
      // Optimistic pin while we look up the address.
      onChange({
        name: value?.name || "Dropped pin",
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
      });
      try {
        const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
        const data = await res.json();
        if (data.result) pick(data.result, true);
      } catch {
        /* keep the optimistic pin */
      }
    },
    [onChange, pick, value?.name],
  );

  const center: [number, number] = value
    ? [value.lat, value.lng]
    : FALLBACK_CENTER;

  return (
    <div className="space-y-3">
      <div className="relative z-[600]">
        <input
          className="field"
          placeholder="Search for a place or address…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          aria-label="Search for a venue"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">
            searching…
          </span>
        )}
        {open && results.length > 0 && (
          <ul className="flash-in absolute z-[1200] mt-1 max-h-64 w-full overflow-auto rounded-xl border-2 border-ink bg-surface shadow-xl">
            {results.map((r, i) => (
              <li key={`${r.lat}-${r.lng}-${i}`}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-grape/10"
                >
                  <span className="font-medium">{r.name}</span>
                  <span className="block text-xs text-muted">{r.address}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="h-[240px] overflow-hidden rounded-2xl border-2 border-ink sm:h-[320px]">
        <MapContainer
          center={center}
          zoom={value ? 15 : 12}
          scrollWheelZoom={false}
          className="h-full w-full"
          ref={mapRef as never}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <ClickHandler onClick={reverse} />
          <Recenter target={value ? [value.lat, value.lng] : null} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  reverse(lat, lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      <p className="text-xs text-muted">
        Tap the map to drop a pin, or drag the marker to fine-tune.
      </p>

      {value && (
        <div className="card-soft p-3">
          <label htmlFor="venue-name" className="eyebrow mb-1 block">
            Venue name (shown to guests)
          </label>
          <input
            id="venue-name"
            className="field"
            maxLength={200}
            required
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
          <p className="mt-2 text-xs text-muted">{value.address}</p>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="mt-2 text-xs font-bold text-coral-ink underline underline-offset-2"
          >
            Remove venue
          </button>
        </div>
      )}
    </div>
  );
}

function ClickHandler({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView(target, Math.max(map.getZoom(), 14));
  }, [target, map]);
  return null;
}
