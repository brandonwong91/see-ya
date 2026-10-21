/** The browser remembers who you are on each plan, so a returning guest lands
 *  on their own answers. The value is the invitee id — the same capability as
 *  a personal `?e=` link — and it never leaves this browser except to load
 *  your own response. Client-only. */
const storageKey = (eventId: string) => `see-ya:you:${eventId}`;

/** Fired on `window` when this tab claims or forgets a name, so other parts
 *  of the page (the RSVP form, the message thread) stay in step. */
export const REMEMBERED_EVENT = "see-ya:you";

export interface RememberedDetail {
  eventId: string;
  inviteeId: string | null;
}

export function remember(eventId: string, inviteeId: string | null) {
  try {
    if (inviteeId) localStorage.setItem(storageKey(eventId), inviteeId);
    else localStorage.removeItem(storageKey(eventId));
  } catch {
    // Private mode or storage disabled — they'll just need to claim again.
  }
  window.dispatchEvent(
    new CustomEvent<RememberedDetail>(REMEMBERED_EVENT, {
      detail: { eventId, inviteeId },
    }),
  );
}

export function recall(eventId: string): string | null {
  try {
    return localStorage.getItem(storageKey(eventId));
  } catch {
    return null;
  }
}
