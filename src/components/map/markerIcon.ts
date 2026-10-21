import L from "leaflet";

/** Leaflet's PNG marker assets break under bundlers, so we draw our own pin as
 *  an inline SVG divIcon. Soft peach on espresso, matches the pastel palette. */
export const pinIcon = L.divIcon({
  className: "es-pin",
  html: `
    <svg width="32" height="42" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 39c0 0 12-14.4 12-24A12 12 0 1 0 3 15c0 9.6 12 24 12 24Z"
        fill="#F9C6B4" stroke="#2C2623" stroke-width="2"/>
      <circle cx="15" cy="15" r="4.5" fill="#FDF2D9"/>
    </svg>`,
  iconSize: [32, 42],
  iconAnchor: [16, 41],
  popupAnchor: [0, -36],
});
