import { getBasket, putBasket, PantryError } from "./pantry";
import { cache } from "react";
import { newEditToken, newEventId, newSubId } from "./ids";
import { formatDateLong, formatTime } from "./format";
import type {
  DateOption,
  EventRecord,
  Invitee,
  ManageEvent,
  Person,
  PublicEvent,
  Venue,
} from "./types";
import type {
  CreateEventInput,
  InviteInput,
  PatchEventInput,
  RsvpInput,
} from "./validation";

const basketName = (id: string) => `event-${id}`;

// ─── Persistence ────────────────────────────────────────────────────────────

export async function getEvent(id: string): Promise<EventRecord | null> {
  if (!/^[a-z0-9]{6,16}$/.test(id)) return null;
  const record = await getBasket<EventRecord>(basketName(id));
  if (!record || !record.id) return null;
  return record;
}

/** Server-component-safe fetch: never throws. `error` is set when the store
 *  itself failed (e.g. a misconfigured PANTRY_ID) as opposed to a missing id. */
export const loadEvent = cache(async (id: string): Promise<{
  event: EventRecord | null;
  error: string | null;
}> => {
  try {
    return { event: await getEvent(id), error: null };
  } catch (err) {
    console.error("loadEvent failed:", err);
    return {
      event: null,
      error:
        err instanceof Error
          ? err.message
          : "Couldn't reach the data store.",
    };
  }
});

export async function saveEvent(event: EventRecord): Promise<void> {
  event.updatedAt = new Date().toISOString();
  await putBasket(basketName(event.id), event);
}

export async function createEvent(
  input: CreateEventInput,
): Promise<EventRecord> {
  const now = new Date().toISOString();
  let id = newEventId();
  // Vanishingly unlikely, but make sure we don't clobber an existing basket.
  for (let i = 0; i < 3; i++) {
    const existing = await getBasket<EventRecord>(basketName(id));
    if (!existing) break;
    id = newEventId();
  }

  const dateOptions: DateOption[] = dedupeDates(input.dates).map((date) => ({
    id: newSubId(),
    date,
    source: "organiser",
    addedBy: input.organiser.name,
    createdAt: now,
  }));

  const invitees: Invitee[] = [];
  const seenEmails = new Set<string>();
  for (const person of input.invitees ?? []) {
    const email = person.email.toLowerCase();
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    invitees.push({
      id: newSubId(),
      name: person.name,
      email,
      availableDateIds: [],
      note: "",
      respondedAt: null,
      invitedAt: now,
      lastNotifiedVersion: 1,
    });
  }

  const event: EventRecord = {
    id,
    editToken: newEditToken(),
    version: 1,
    createdAt: now,
    updatedAt: now,
    title: input.title,
    description: input.description ?? "",
    organiser: input.organiser,
    time: input.time ?? null,
    timezone: input.timezone ?? null,
    venue: input.venue ?? null,
    dateOptions,
    finalizedDateId: null,
    invitees,
    changeLog: [{ at: now, version: 1, summary: "Event created", fields: [] }],
  };

  await putBasket(basketName(id), event);
  return event;
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export interface PatchResult {
  event: EventRecord;
  changes: string[];
  /** True when date / time / venue changed — triggers re-invites. */
  material: boolean;
}

export function applyPatch(
  event: EventRecord,
  input: PatchEventInput,
): PatchResult {
  const changes: string[] = [];
  let material = false;

  if (input.title !== undefined && input.title !== event.title) {
    changes.push(`Title changed to "${input.title}"`);
    event.title = input.title;
  }
  if (
    input.description !== undefined &&
    input.description !== event.description
  ) {
    changes.push("Description updated");
    event.description = input.description;
  }
  if (input.time !== undefined && (input.time ?? null) !== event.time) {
    const next = input.time ?? null;
    changes.push(
      next ? `Time set to ${formatTime(next)}` : "Time removed",
    );
    event.time = next;
    material = true;
  }
  if (
    input.timezone !== undefined &&
    (input.timezone ?? null) !== event.timezone
  ) {
    event.timezone = input.timezone ?? null;
  }
  if (input.venue !== undefined) {
    material = venueChanged(event.venue, input.venue ?? null) || material;
    if (venueChanged(event.venue, input.venue ?? null)) {
      changes.push(
        input.venue
          ? `Venue changed to ${input.venue.name}`
          : "Venue removed",
      );
    }
    event.venue = input.venue ?? null;
  }
  if (input.dates !== undefined) {
    const result = reconcileOrganiserDates(event, input.dates);
    if (result.added.length) {
      changes.push(
        `Added date${result.added.length > 1 ? "s" : ""}: ` +
          result.added.map((d) => formatDateLong(d)).join(", "),
      );
      material = true;
    }
    if (result.removed.length) {
      changes.push(
        `Removed date${result.removed.length > 1 ? "s" : ""}: ` +
          result.removed.map((d) => formatDateLong(d)).join(", "),
      );
      material = true;
    }
  }

  if (changes.length) {
    event.version += 1;
    event.changeLog.push({
      at: new Date().toISOString(),
      version: event.version,
      summary: changes.join("; "),
      fields: [],
    });
  }

  return { event, changes, material };
}

export interface RsvpResult {
  event: EventRecord;
  invitee: Invitee;
  isNew: boolean;
  addedDates: DateOption[];
}

export function applyRsvp(event: EventRecord, input: RsvpInput): RsvpResult {
  const now = new Date().toISOString();
  const email = input.email.toLowerCase();

  let invitee = event.invitees.find((i) => i.email.toLowerCase() === email);
  const isNew = !invitee;
  if (!invitee) {
    invitee = {
      id: newSubId(),
      name: input.name,
      email,
      availableDateIds: [],
      note: "",
      respondedAt: null,
      invitedAt: null,
      lastNotifiedVersion: 0,
    };
    event.invitees.push(invitee);
  }
  invitee.name = input.name || invitee.name;

  // Invitee-proposed new dates.
  const addedDates: DateOption[] = [];
  const existingDates = new Set(event.dateOptions.map((d) => d.date));
  for (const date of dedupeDates(input.proposeDates)) {
    if (existingDates.has(date)) {
      // They proposed a date that already exists — just mark them available.
      const opt = event.dateOptions.find((d) => d.date === date)!;
      if (!input.availableDateIds.includes(opt.id)) {
        input.availableDateIds.push(opt.id);
      }
      continue;
    }
    const opt: DateOption = {
      id: newSubId(),
      date,
      source: "invitee",
      addedBy: input.name,
      createdAt: now,
    };
    event.dateOptions.push(opt);
    addedDates.push(opt);
    existingDates.add(date);
    input.availableDateIds.push(opt.id);
  }

  const validIds = new Set(event.dateOptions.map((d) => d.id));
  invitee.availableDateIds = [...new Set(input.availableDateIds)].filter((id) =>
    validIds.has(id),
  );
  invitee.note = input.note ?? "";
  invitee.respondedAt = now;

  sortDateOptions(event);
  return { event, invitee, isNew, addedDates };
}

export interface InviteResult {
  event: EventRecord;
  invitees: Invitee[];
}

export function addInvitees(
  event: EventRecord,
  input: InviteInput,
): InviteResult {
  const now = new Date().toISOString();
  const added: Invitee[] = [];
  for (const person of input.people) {
    const email = person.email.toLowerCase();
    let invitee = event.invitees.find((i) => i.email.toLowerCase() === email);
    if (!invitee) {
      invitee = {
        id: newSubId(),
        name: person.name,
        email,
        availableDateIds: [],
        note: "",
        respondedAt: null,
        invitedAt: now,
        lastNotifiedVersion: event.version,
      };
      event.invitees.push(invitee);
    } else {
      invitee.invitedAt = now;
    }
    added.push(invitee);
  }
  return { event, invitees: added };
}

export function finalize(
  event: EventRecord,
  dateId: string,
): { event: EventRecord; dateOption: DateOption } {
  const dateOption = event.dateOptions.find((d) => d.id === dateId);
  if (!dateOption) {
    throw new PantryError("That date option no longer exists", 400);
  }
  event.finalizedDateId = dateId;
  event.version += 1;
  event.changeLog.push({
    at: new Date().toISOString(),
    version: event.version,
    summary: `Finalised for ${formatDateLong(dateOption.date)}`,
    fields: [],
  });
  return { event, dateOption };
}

export function reopenEvent(event: EventRecord): EventRecord {
  if (event.finalizedDateId) {
    event.finalizedDateId = null;
    event.version += 1;
    event.changeLog.push({
      at: new Date().toISOString(),
      version: event.version,
      summary: "Re-opened for scheduling",
      fields: [],
    });
  }
  return event;
}

// ─── Projections ────────────────────────────────────────────────────────────

export function computeTally(event: EventRecord): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const opt of event.dateOptions) tally[opt.id] = 0;
  for (const inv of event.invitees) {
    for (const id of inv.availableDateIds) {
      if (id in tally) tally[id] += 1;
    }
  }
  return tally;
}

export function toPublicEvent(event: EventRecord): PublicEvent {
  return {
    id: event.id,
    version: event.version,
    title: event.title,
    description: event.description,
    organiserName: event.organiser.name,
    time: event.time,
    timezone: event.timezone,
    venue: event.venue,
    dateOptions: event.dateOptions,
    finalizedDateId: event.finalizedDateId,
    tally: computeTally(event),
    responseCount: event.invitees.filter((i) => i.respondedAt).length,
  };
}

export function toManageEvent(event: EventRecord): ManageEvent {
  const { editToken: _drop, ...rest } = event;
  void _drop;
  return rest;
}

/** Recipients we should notify on a material change: anyone invited or who
 *  responded, plus the organiser. */
export function notifyRecipients(event: EventRecord): Invitee[] {
  return event.invitees.filter((i) => i.respondedAt || i.invitedAt);
}

// ─── Internals ──────────────────────────────────────────────────────────────

function dedupeDates(dates: string[]): string[] {
  return [...new Set(dates)].sort();
}

function venueChanged(a: Venue | null, b: Venue | null): boolean {
  if (!a && !b) return false;
  if (!a || !b) return true;
  return (
    a.name !== b.name ||
    a.address !== b.address ||
    Math.abs(a.lat - b.lat) > 1e-6 ||
    Math.abs(a.lng - b.lng) > 1e-6
  );
}

function reconcileOrganiserDates(
  event: EventRecord,
  desired: string[],
): { added: string[]; removed: string[] } {
  const desiredSet = new Set(dedupeDates(desired));
  const currentOrganiserDates = new Set(
    event.dateOptions.filter((d) => d.source === "organiser").map((d) => d.date),
  );

  const added: string[] = [];
  const removed: string[] = [];
  const now = new Date().toISOString();

  // Add new organiser dates (unless an invitee already proposed that day).
  for (const date of desiredSet) {
    if (event.dateOptions.some((d) => d.date === date)) continue;
    event.dateOptions.push({
      id: newSubId(),
      date,
      source: "organiser",
      addedBy: event.organiser.name,
      createdAt: now,
    });
    added.push(date);
  }

  // Remove organiser dates no longer desired. Keep invitee-proposed dates.
  event.dateOptions = event.dateOptions.filter((d) => {
    if (d.source !== "organiser") return true;
    if (desiredSet.has(d.date)) return true;
    if (currentOrganiserDates.has(d.date)) {
      removed.push(d.date);
      // Drop it from everyone's availability too.
      for (const inv of event.invitees) {
        inv.availableDateIds = inv.availableDateIds.filter((id) => id !== d.id);
      }
      if (event.finalizedDateId === d.id) event.finalizedDateId = null;
      return false;
    }
    return true;
  });

  sortDateOptions(event);
  return { added, removed };
}

function sortDateOptions(event: EventRecord): void {
  event.dateOptions.sort((a, b) => a.date.localeCompare(b.date));
}

export function personLabel(p: Person): string {
  return `${p.name} <${p.email}>`;
}
