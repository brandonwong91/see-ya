export interface Person {
  name: string;
  email: string;
}

export interface Venue {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export type DateOptionSource = "organiser" | "invitee";

export interface DateOption {
  id: string;
  /** ISO date, `YYYY-MM-DD`. Time is stored separately on the event. */
  date: string;
  source: DateOptionSource;
  /** Display name of whoever added it. */
  addedBy: string;
  createdAt: string;
}

export interface Invitee {
  id: string;
  name: string;
  /** Empty when the organiser only listed a name. */
  email: string;
  /** IDs of the date options this person marked themselves available for. */
  availableDateIds: string[];
  note: string;
  respondedAt: string | null;
  invitedAt: string | null;
  /** Bumped every time we email this person, so the manage view can show it. */
  lastNotifiedVersion: number;
  /** Set when a visitor claims this name from the share link. */
  claimedAt?: string | null;
  /** Last time we emailed this person their personal link on request. */
  linkSentAt?: string | null;
}

export type ClaimRequestStatus = "pending" | "approved" | "declined";

/** Someone asking the organiser for a name that is already claimed. */
export interface ClaimRequest {
  id: string;
  inviteeId: string;
  /** Name on the guest list they asked for, kept for display after resolving. */
  seatName: string;
  name: string;
  email: string;
  message: string;
  status: ClaimRequestStatus;
  createdAt: string;
  resolvedAt: string | null;
}

/** How a listed name looks from the share link. */
export type SeatStatus = "open" | "taken" | "emailed";

export interface Seat {
  /** Public handle for an invitee; never the invitee id itself. */
  seatId: string;
  name: string;
  status: SeatStatus;
}

export interface ChangeLogEntry {
  at: string;
  version: number;
  summary: string;
  fields: string[];
}

export interface EventRecord {
  id: string;
  /** Secret. Only the organiser link carries this. Never sent to public views. */
  editToken: string;
  version: number;
  createdAt: string;
  updatedAt: string;

  title: string;
  description: string;
  organiser: Person;

  /** Optional wall-clock time that applies to whichever date is chosen, `HH:mm`. */
  time: string | null;
  /** IANA-ish timezone label the organiser typed, purely informational. */
  timezone: string | null;
  venue: Venue | null;

  dateOptions: DateOption[];
  /** When the organiser locks the plan in, this points at the winning option. */
  finalizedDateId: string | null;

  invitees: Invitee[];
  changeLog: ChangeLogEntry[];
  claimRequests?: ClaimRequest[];
}

/** Shape returned to public (RSVP) clients — secrets and PII stripped. */
export interface PublicEvent {
  id: string;
  version: number;
  title: string;
  description: string;
  organiserName: string;
  time: string | null;
  timezone: string | null;
  venue: Venue | null;
  dateOptions: DateOption[];
  finalizedDateId: string | null;
  /** Per option: how many invitees are available. */
  tally: Record<string, number>;
  responseCount: number;
  /** Names the organiser listed, so visitors can claim theirs. */
  roster: Seat[];
}

/** Shape returned to the organiser (manage) view — full detail, minus editToken. */
export type ManageEvent = Omit<EventRecord, "editToken">;
