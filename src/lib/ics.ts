import type { EventRecord } from "./types";
import { calendarLocation, calendarSlot, calendarTitle } from "./calendar";

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
 * Build an .ics for the event on `date`. If the event has a `time`, we emit a
 * 2-hour timed event in floating local time; otherwise an all-day event.
 *
 * `tentative` marks a hold for a date that isn't locked in yet. Holds share
 * the confirmed entry's UID, so importing the confirmation later updates the
 * hold instead of duplicating it.
 */
export function buildIcs(
  event: EventRecord,
  date: string,
  { tentative = false }: { tentative?: boolean } = {},
): string {
  const now = new Date();
  const uid = `${event.id}-${date}@see-ya`;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//See Ya//EN",
    "CALSCALE:GREGORIAN",
    tentative ? "METHOD:PUBLISH" : "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(now)}`,
    `SEQUENCE:${event.version}`,
  ];

  const slot = calendarSlot(date, event.time);
  if (slot.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${slot.start}`, `DTEND;VALUE=DATE:${slot.end}`);
  } else {
    lines.push(`DTSTART:${slot.start}`, `DTEND:${slot.end}`);
  }

  lines.push(`SUMMARY:${esc(calendarTitle(event.title, tentative))}`);
  if (event.description) lines.push(`DESCRIPTION:${esc(event.description)}`);
  if (event.venue) {
    lines.push(`LOCATION:${esc(calendarLocation(event.venue))}`);
    lines.push(`GEO:${event.venue.lat};${event.venue.lng}`);
  }
  lines.push(
    `ORGANIZER;CN=${esc(event.organiser.name)}:mailto:${event.organiser.email}`,
  );
  lines.push(
    tentative ? "STATUS:TENTATIVE" : "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  );

  return lines.map(fold).join("\r\n");
}
