import { customAlphabet } from "nanoid";

// URL-safe, unambiguous alphabet (no look-alikes like 0/O, 1/l/I).
const readable = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 10);
const token = customAlphabet(
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789",
  28,
);

/** Public event identifier, e.g. `k7m2p9qab3`. Appears in URLs and emails. */
export function newEventId(): string {
  return readable();
}

/** Secret organiser token. Long enough that it can't be guessed. */
export function newEditToken(): string {
  return token();
}

/** Short id for a nested record (date option, invitee). */
export function newSubId(): string {
  return readable().slice(0, 8);
}
