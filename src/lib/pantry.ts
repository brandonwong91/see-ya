/**
 * Thin wrapper around the Pantry API (https://getpantry.cloud).
 *
 * Pantry stores JSON "baskets" inside a single "pantry" identified by a UUID.
 * There is no auth beyond knowing the UUID. Baskets are wiped after 30 days of
 * inactivity and capped at ~1.44 MB — both fine for a single event record.
 *
 * We only ever do full-object writes (POST replaces basket contents). Pantry's
 * PUT does a deep merge that mangles arrays, so we avoid it.
 *
 * When PANTRY_ID is not set we transparently fall back to a local .pantry-dev/
 * JSON directory so the app runs out of the box in development.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const BASE = "https://getpantry.cloud/apiv1/pantry";

export class PantryError extends Error {
  status: number;
  retryAfter?: number;
  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = "PantryError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

const PANTRY_ID = process.env.PANTRY_ID?.trim();
// Treat an empty value or the env.example placeholder as "not configured".
const usingLocal = !PANTRY_ID || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(PANTRY_ID);

interface EncryptedBasket {
  _seeYaEncrypted: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
}

function encryptionKey(): Buffer | null {
  const encoded = process.env.PANTRY_ENCRYPTION_KEY?.trim();
  if (!encoded) return null;
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw new PantryError(
      "PANTRY_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
      500,
    );
  }
  return key;
}

function encryptBasket(basket: string, data: unknown): unknown {
  const key = encryptionKey();
  if (!key) {
    if (usingLocal) return data;
    throw new PantryError(
      "Set PANTRY_ENCRYPTION_KEY on the server before saving plans to Pantry.",
      500,
    );
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  // Bind the ciphertext to its basket, so copying it to another event fails.
  cipher.setAAD(Buffer.from(`see-ya:pantry:v1:${basket}`));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return {
    _seeYaEncrypted: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  } satisfies EncryptedBasket;
}

function decryptBasket<T>(basket: string, stored: unknown): T | null {
  if (stored === null) return null;
  // Legacy records remain readable and are encrypted on their next save.
  if (!stored || typeof stored !== "object" || !("_seeYaEncrypted" in stored)) {
    return stored as T;
  }
  const key = encryptionKey();
  if (!key) {
    throw new PantryError(
      "This plan is encrypted. Restore PANTRY_ENCRYPTION_KEY on the server to read it.",
      500,
    );
  }
  try {
    const envelope = stored as EncryptedBasket;
    if (
      envelope._seeYaEncrypted !== 1 ||
      envelope.algorithm !== "aes-256-gcm"
    ) {
      throw new Error("Unsupported encryption format");
    }
    const decode = (value: string, length?: number) => {
      if (typeof value !== "string" || !value)
        throw new Error("Missing encrypted data");
      const bytes = Buffer.from(value, "base64");
      if (
        bytes.toString("base64") !== value ||
        (length && bytes.length !== length)
      ) {
        throw new Error("Invalid encrypted data");
      }
      return bytes;
    };
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      decode(envelope.iv, 12),
      { authTagLength: 16 },
    );
    decipher.setAAD(Buffer.from(`see-ya:pantry:v1:${basket}`));
    decipher.setAuthTag(decode(envelope.tag, 16));
    const plaintext = Buffer.concat([
      decipher.update(decode(envelope.ciphertext)),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  } catch {
    // Never expose plaintext, key material, or raw crypto errors in responses.
    throw new PantryError(
      "Could not decrypt this plan. Check the server encryption key and stored data.",
      500,
    );
  }
}
let warned = false;
function warnLocalOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    "\n[pantry] PANTRY_ID is not set — using local .pantry-dev/ store. " +
      "Set PANTRY_ID in .env.local for real persistence.\n",
  );
}

// ─── Local dev driver ───────────────────────────────────────────────────────

const LOCAL_DIR = path.join(process.cwd(), ".pantry-dev");

async function localGet<T>(basket: string): Promise<T | null> {
  warnLocalOnce();
  try {
    const raw = await fs.readFile(
      path.join(LOCAL_DIR, `${basket}.json`),
      "utf-8",
    );
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function localPut(basket: string, data: unknown): Promise<void> {
  warnLocalOnce();
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(
    path.join(LOCAL_DIR, `${basket}.json`),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

async function localDelete(basket: string): Promise<void> {
  try {
    await fs.unlink(path.join(LOCAL_DIR, `${basket}.json`));
  } catch {
    /* already gone */
  }
}

// ─── Pantry HTTP driver ─────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Pace all baskets together: separate page/API requests share the same pantry.
// This is per server process; multiple instances still share Pantry's quota.
const REQUEST_INTERVAL_MS = 1_100;
const MAX_RETRY_WAIT_MS = 10_000;
type RequestState = {
  nextRequestAt: number;
  rateLimitedUntil: number;
  queue: Promise<void>;
};
// Keep pacing across Next route bundles and development hot reloads.
const pantryGlobal = globalThis as typeof globalThis & {
  seeYaPantryRequests?: RequestState;
};
const requestState = (pantryGlobal.seeYaPantryRequests ??= {
  nextRequestAt: 0,
  rateLimitedUntil: 0,
  queue: Promise.resolve(),
});

function rateLimitError(): PantryError {
  const seconds = Math.max(
    1,
    Math.ceil((requestState.rateLimitedUntil - Date.now()) / 1_000),
  );
  return new PantryError(
    `The event store is temporarily rate limited. Please try again in ${seconds} seconds.`,
    503,
    seconds,
  );
}

function retryDelay(value: string | null, fallback: number): number {
  if (!value?.trim()) return fallback;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : fallback;
}

function pantryRateLimitDelay(body: string): number {
  // Pantry's older limiter puts its reset time in plain text instead of a
  // Retry-After header: "Please wait till <date> to make future requests".
  const reset = /Please wait till (.+?) to make future requests/i.exec(
    body,
  )?.[1];
  const timestamp = reset ? Date.parse(reset) : NaN;
  return Number.isFinite(timestamp)
    ? Math.max(REQUEST_INTERVAL_MS, timestamp - Date.now())
    : 10_000;
}

async function request(
  method: "GET" | "POST" | "DELETE",
  basket: string,
  body?: unknown,
): Promise<Response> {
  const previous = requestState.queue;
  let release!: () => void;
  requestState.queue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await requestWithRetry(method, basket, body);
  } finally {
    release();
  }
}

async function requestWithRetry(
  method: "GET" | "POST" | "DELETE",
  basket: string,
  body?: unknown,
): Promise<Response> {
  const url = `${BASE}/${PANTRY_ID}/basket/${encodeURIComponent(basket)}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (requestState.rateLimitedUntil - Date.now() > MAX_RETRY_WAIT_MS) {
      throw rateLimitError();
    }
    const wait =
      Math.max(requestState.nextRequestAt, requestState.rateLimitedUntil) -
      Date.now();
    if (wait > 0) await sleep(wait);
    requestState.nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        // Next memoizes GETs within a render even with no-store. A fresh signal
        // opts out, so retries reach Pantry instead of replaying the same 429.
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      lastErr = err;
      if (attempt < 3) await sleep(1_000 * 2 ** attempt);
      continue;
    }

    if (res.status !== 429 && res.status < 500) return res;

    const bodyText = await res.text().catch(() => "");
    const delay = retryDelay(
      res.headers.get("Retry-After"),
      res.status === 429
        ? pantryRateLimitDelay(bodyText)
        : 2_000 * 2 ** attempt,
    );
    if (res.status === 429) {
      requestState.rateLimitedUntil =
        Date.now() + Math.max(REQUEST_INTERVAL_MS, delay);
      lastErr = rateLimitError();
    } else {
      lastErr = new PantryError(`Pantry responded ${res.status}`, 502);
    }
    if (attempt < 3) {
      if (delay > MAX_RETRY_WAIT_MS) break;
      await sleep(delay);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new PantryError("Pantry request failed", 502);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Pantry answers 400 + "<basket> does not exist" when a basket is missing.
 *  A bad *pantry* id instead says "pantry with id: … not found". */
function isMissingBasket(bodyText: string): boolean {
  return /does not exist/i.test(bodyText) && !/pantry with id/i.test(bodyText);
}

function isBadPantryId(bodyText: string): boolean {
  return /pantry with id[^]*not found|pantry hierarchy|check that the pantry/i.test(
    bodyText,
  );
}

/** Turn a Pantry failure into an actionable error. */
function pantryFailure(
  action: string,
  status: number,
  bodyText: string,
): never {
  const body = bodyText.trim().slice(0, 300);
  if (isBadPantryId(body)) {
    throw new PantryError(
      "Your PANTRY_ID isn't a real pantry. Create one at getpantry.cloud " +
        "(you'll be emailed a UUID) and put it in .env / .env.local, then " +
        `restart the server. Pantry said: "${body}"`,
      502,
    );
  }
  throw new PantryError(
    `Failed to ${action} (Pantry ${status})${body ? `: ${body}` : ""}`,
    502,
  );
}

/** Returns the parsed basket contents, or `null` if the basket doesn't exist. */
export async function getBasket<T>(basket: string): Promise<T | null> {
  if (usingLocal)
    return decryptBasket<T>(basket, await localGet<unknown>(basket));

  const res = await request("GET", basket);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 400 && isMissingBasket(text)) return null;
    pantryFailure("read basket", res.status, text);
  }
  return decryptBasket<T>(basket, await res.json());
}

/** Creates or fully replaces a basket's contents. */
export async function putBasket(basket: string, data: unknown): Promise<void> {
  const stored = encryptBasket(basket, data);
  if (usingLocal) return localPut(basket, stored);

  const res = await request("POST", basket, stored);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    pantryFailure("write basket", res.status, text);
  }
}

export async function deleteBasket(basket: string): Promise<void> {
  if (usingLocal) return localDelete(basket);

  const res = await request("DELETE", basket);
  if (!res.ok && res.status !== 400 && res.status !== 404) {
    throw new PantryError(`Failed to delete basket (${res.status})`, 502);
  }
}
