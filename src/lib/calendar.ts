/** Calendar helpers shared by server (emails, .ics) and client (buttons). Pure,
 *  no deps beyond Intl so they run anywhere. */

import type { Venue } from "./types";

/** The fields of an event a calendar entry needs; both the full record and the
 *  public projection satisfy it. */
export interface CalendarSource {
  id: string;
  title: string;
  description: string;
  time: string | null;
  timezone: string | null;
  venue: Venue | null;
}

/** How long a timed entry lasts — the plan has no end time of its own. */
const DURATION_HOURS = 2;

function compact(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "");
}

/**
 * Start and end in iCalendar "basic" form. With a time: floating local
 * `YYYYMMDDTHHMMSS`, ending two hours later (rolling past midnight if needed).
 * Without: an all-day `YYYYMMDD` range whose end is exclusive.
 */
export function calendarSlot(
  date: string,
  time: string | null,
): { start: string; end: string; allDay: boolean } {
  // Do the arithmetic in UTC so the host's timezone can't shift the wall clock.
  const base = new Date(`${date}T${time ?? "00:00"}:00Z`);
  if (!time) {
    const next = new Date(base.getTime() + 86_400_000);
    return {
      start: compact(base).slice(0, 8),
      end: compact(next).slice(0, 8),
      allDay: true,
    };
  }
  const end = new Date(base.getTime() + DURATION_HOURS * 3_600_000);
  return { start: compact(base), end: compact(end), allDay: false };
}

/** True when the organiser's timezone label is a real IANA zone. */
export function isIanaZone(tz: string | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function calendarTitle(title: string, tentative: boolean): string {
  return tentative ? `(Tentative) ${title}` : title;
}

export function calendarLocation(venue: Venue | null): string {
  if (!venue) return "";
  return venue.address ? `${venue.name}, ${venue.address}` : venue.name;
}

/** Prefilled "add event" link for Google Calendar. */
export function googleCalendarUrl(
  event: CalendarSource,
  date: string,
  { tentative = false, link }: { tentative?: boolean; link?: string } = {},
): string {
  const slot = calendarSlot(date, event.time);
  const details = [
    tentative ? "Pencilled in — the organiser hasn't locked this date yet." : "",
    event.description,
    link ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: calendarTitle(event.title, tentative),
    dates: `${slot.start}/${slot.end}`,
  });
  if (details) params.set("details", details);
  const location = calendarLocation(event.venue);
  if (location) params.set("location", location);
  if (!slot.allDay && isIanaZone(event.timezone)) {
    params.set("ctz", event.timezone);
  }
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Path to the downloadable .ics. Without a date id it serves the confirmed
 *  date; with one, a tentative hold for that option. */
export function icsPath(eventId: string, dateId?: string): string {
  return dateId
    ? `/api/events/${eventId}/ics?date=${encodeURIComponent(dateId)}`
    : `/api/events/${eventId}/ics`;
}
