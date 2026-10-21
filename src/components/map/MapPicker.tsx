"use client";

import dynamic from "next/dynamic";
import type { Venue } from "@/lib/types";

const MapPickerClient = dynamic(() => import("./MapPicker.client"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[240px] animate-pulse rounded-2xl border-2 border-line-strong bg-line/40 sm:h-[320px]"
      role="status"
      aria-label="Loading venue map"
    />
  ),
});

export function MapPicker(props: {
  value: Venue | null;
  onChange: (v: Venue | null) => void;
}) {
  return <MapPickerClient {...props} />;
}
