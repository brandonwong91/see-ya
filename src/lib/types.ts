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

export type CommentVisibility = "public" | "organiser";

/** A message left on the plan. Guests post once they've claimed a name or
 *  opened their personal link; the organiser posts from the dashboard. */
export interface Comment {
  id: string;
  /** Invitee id of the guest who wrote it; null when the organiser did. Never
   *  sent to public views — it doubles as the guest's personal link. */
  authorId: string | null;
  authorName: string;
  body: string;
  /** `organiser` messages are only seen by the organiser and their author. */
  visibility: CommentVisibility;
  createdAt: string;
  /** Set when the organiser handed the author's name to someone else. The
   *  earlier claimer loses access, so their private messages stay with the
   *  organiser only; `email` is theirs, kept so the organiser can still reply. */
  handedOver?: { at: string; email: string };
}

/** A comment as a guest sees it. */
export interface PublicComment {
  id: string;
  authorName: string;
  body: string;
  visibility: CommentVisibility;
  fromOrganiser: boolean;
  /** True when the viewer wrote it. */
  mine: boolean;
  createdAt: string;
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
  comments?: Comment[];
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
