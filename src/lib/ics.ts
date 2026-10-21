import type { EventRecord } from "./types";

/** Fold long lines at 75 octets per RFC 5545. */
function fold(line: string): string {
  const out: string[] = [];
  let s = line;
  while (s.length > 74) {
    out.push(out.length === 0 ? s.slice(0, 74) : " " + s.slice(0, 73));
    s = s.slice(out.length === 1 ? 74 : 73);
  }
  out.push(out.length === 0 ? s : " " + s);
  return out.join("\r\n");
}

function esc(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Build an .ics for the event. Requires a resolved date — pass the winning
 * DateOption's `date`. If the event has a `time`, we emit a 2-hour timed event
 * in floating local time; otherwise an all-day event.
 */
export function buildIcs(event: EventRecord, date: string): string {
  const now = new Date();
  const uid = `${event.id}-${date}@see-ya`;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//See Ya//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(now)}`,
    `SEQUENCE:${event.version}`,
  ];

  if (event.time) {
    const [h, m] = event.time.split(":").map(Number);
    const start = date.replace(/-/g, "") + "T" + pad(h) + pad(m) + "00";
    const endH = (h + 2) % 24;
    const end = date.replace(/-/g, "") + "T" + pad(endH) + pad(m) + "00";
    lines.push(`DTSTART:${start}`, `DTEND:${end}`);
  } else {
    const d = date.replace(/-/g, "");
    const next = stamp(new Date(new Date(date + "T00:00:00Z").getTime() + 86400000)).slice(0, 8);
    lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`);
  }

  lines.push(`SUMMARY:${esc(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${esc(event.description)}`);
  if (event.venue) {
    lines.push(`LOCATION:${esc(event.venue.name + ", " + event.venue.address)}`);
    lines.push(`GEO:${event.venue.lat};${event.venue.lng}`);
  }
  lines.push(
    `ORGANIZER;CN=${esc(event.organiser.name)}:mailto:${event.organiser.email}`,
  );
  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");

  return lines.map(fold).join("\r\n");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
