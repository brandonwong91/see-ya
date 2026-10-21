/** Formatting helpers shared by server (emails) and client (UI). Pure, no deps
 *  beyond Intl so they run anywhere. */

export function formatDateLong(iso: string): string {
  // iso is YYYY-MM-DD — parse as local noon to dodge timezone rollover.
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatDayNum(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit" });
}

export function formatMonth(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
}

export function formatWeekday(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}

export function isPast(iso: string): boolean {
  const d = new Date(iso + "T23:59:59");
  return d.getTime() < Date.now();
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
