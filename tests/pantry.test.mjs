import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

// Run the actual driver with a fake clock and fetch; never contact a real pantry.
const source = ts.transpileModule(
  readFileSync(new URL("../src/lib/pantry.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  },
).outputText;

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

function driver(responses, key = TEST_KEY) {
  let now = Date.parse("2026-10-21T00:00:00Z");
  const calls = [];
  const waits = [];
  const exports = {};
  class Clock extends Date {
    static now() {
      return now;
    }
  }
  vm.runInNewContext(source, {
    exports,
    require: createRequire(import.meta.url),
    process: {
      env: { PANTRY_ID: "test-pantry", PANTRY_ENCRYPTION_KEY: key },
      cwd: () => "/unused",
    },
    console,
    Error,
    AbortSignal,
    Buffer,
    Date: Clock,
    setTimeout(callback, ms) {
      waits.push(ms);
      now += ms;
      callback();
    },
    async fetch(url, init) {
      calls.push({
        url,
        method: init.method,
        signal: init.signal,
        body: init.body,
        at: now,
      });
      assert.ok(responses.length, "unexpected upstream request");
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  });
  return {
    ...exports,
    calls,
    waits,
    advance: (ms) => {
      now += ms;
    },
  };
}

const success = (data = { id: "event" }) => Response.json(data);
const limited = (retryAfter) =>
  new Response("Too many requests", {
    status: 429,
    headers: retryAfter ? { "Retry-After": retryAfter } : {},
  });

test("creation's read/write/dashboard read are paced across baskets", async () => {
  const store = driver([
    new Response("event-test does not exist", { status: 400 }),
    new Response("saved"),
    success(),
  ]);
  assert.equal(await store.getBasket("event-test"), null);
  await store.putBasket("event-test", { id: "event" });
  assert.equal((await store.getBasket("event-test")).id, "event");
  assert.equal(store.calls.length, 3);
  for (let i = 1; i < store.calls.length; i++) {
    assert.ok(store.calls[i].at - store.calls[i - 1].at >= 1_100);
  }
});

test("concurrent reads share the request queue", async () => {
  const store = driver([success(), success(), success()]);
  await Promise.all([
    store.getBasket("a"),
    store.getBasket("b"),
    store.getBasket("c"),
  ]);
  assert.equal(store.calls.length, 3);
  for (let i = 1; i < store.calls.length; i++) {
    assert.ok(store.calls[i].at - store.calls[i - 1].at >= 1_100);
  }
});

test("honors Retry-After seconds before retrying a 429", async () => {
  const store = driver([limited("5"), success()]);
  assert.equal((await store.getBasket("a")).id, "event");
  assert.equal(store.calls[1].at - store.calls[0].at, 5_000);
  assert.ok(store.calls[0].signal instanceof AbortSignal);
  assert.ok(store.calls[1].signal instanceof AbortSignal);
  assert.notEqual(store.calls[0].signal, store.calls[1].signal);
});

test(
  "retries a cloned fetch response without blocking on stream cancellation",
  { timeout: 1_000 },
  async () => {
    // Next's fetch deduplication clones responses. Awaiting cancel() on one
    // branch can block until the other branch is consumed.
    const response = limited("1");
    const store = driver([response.clone(), success()]);
    assert.equal((await store.getBasket("a")).id, "event");
    assert.equal(store.calls.length, 2);
  },
);

test("honors Retry-After HTTP dates", async () => {
  const date = new Date("2026-10-21T00:00:07Z").toUTCString();
  const store = driver([limited(date), success()]);
  await store.getBasket("a");
  assert.equal(store.calls[1].at - store.calls[0].at, 7_000);
});

test("long cooldown returns 503 and blocks other baskets until expiry", async () => {
  const store = driver([limited("60"), success()]);
  const checkError = (err) => err.status === 503 && err.retryAfter === 60;
  await assert.rejects(store.getBasket("a"), checkError);
  await assert.rejects(store.getBasket("b"), checkError);
  assert.equal(store.calls.length, 1);
  store.advance(60_000);
  await store.getBasket("b");
  assert.equal(store.calls.length, 2);
});

test("repeated headerless 429s wait for Pantry's cooldown and stop after four attempts", async () => {
  const store = driver([limited(), limited(), limited(), limited()]);
  await assert.rejects(store.getBasket("a"), (err) => err.status === 503);
  assert.equal(store.calls.length, 4);
  assert.deepEqual(store.waits, [10_000, 10_000, 10_000]);
});

test("honors Pantry's reset timestamp in a headerless 429 body", async () => {
  const reset = new Date("2026-10-21T00:00:09Z").toString();
  const store = driver([
    new Response(
      `Pantry API limit reached. Please wait till ${reset} to make future requests`,
      { status: 429 },
    ),
    success(),
  ]);
  await store.getBasket("a");
  assert.equal(store.calls[1].at - store.calls[0].at, 9_000);
});

test("queue recovers after network retries are exhausted", async () => {
  const store = driver([
    new Error("offline"),
    new Error("offline"),
    new Error("offline"),
    new Error("offline"),
    success(),
  ]);
  await assert.rejects(store.getBasket("a"), /offline/);
  assert.deepEqual(store.waits, [1_000, 100, 2_000, 4_000]);
  await store.getBasket("b");
  assert.equal(store.calls.length, 5);
});

test("5xx can recover, while invalid pantry errors are not retried", async () => {
  const store = driver([
    new Response("unavailable", { status: 503 }),
    success(),
    new Response("pantry with id: test-pantry not found", { status: 400 }),
  ]);
  await store.getBasket("a");
  await assert.rejects(store.getBasket("b"), /isn't a real pantry/);
  assert.equal(store.calls.length, 3);
});

const privatePlan = {
  id: "private-plan",
  title: "Dinner with friends",
  organiser: { name: "Aisha", email: "aisha@example.com" },
  editToken: "private-organiser-token",
  venue: { name: "Private address", lat: 1.2, lng: 103.8 },
  invitees: [
    { name: "Marco", email: "marco@example.com", note: "A private RSVP note" },
  ],
};

async function encryptedPlan() {
  const store = driver([new Response("saved")]);
  await store.putBasket("event-private-plan", privatePlan);
  return JSON.parse(store.calls[0].body);
}

test("encrypts the entire uploaded plan and decrypts Pantry's response", async () => {
  const envelope = await encryptedPlan();
  assert.equal(envelope._seeYaEncrypted, 1);
  assert.equal(envelope.algorithm, "aes-256-gcm");
  const uploaded = JSON.stringify(envelope);
  for (const secret of [
    privatePlan.title,
    privatePlan.organiser.name,
    privatePlan.organiser.email,
    privatePlan.editToken,
    privatePlan.venue.name,
    privatePlan.invitees[0].email,
    privatePlan.invitees[0].note,
  ]) {
    assert.ok(!uploaded.includes(secret), `plaintext leaked: ${secret}`);
  }
  const store = driver([
    Response.json({
      ...envelope,
      _metadata: { createdAt: "provider metadata" },
    }),
  ]);
  const decoded = await store.getBasket("event-private-plan");
  assert.deepEqual(JSON.parse(JSON.stringify(decoded)), privatePlan);
});

test("uses a fresh nonce and different ciphertext for every save", async () => {
  const first = await encryptedPlan();
  const second = await encryptedPlan();
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test("encrypted baskets cannot be decrypted with a different key or basket name", async () => {
  const envelope = await encryptedPlan();
  const wrongKey = driver(
    [Response.json(envelope)],
    Buffer.alloc(32, 8).toString("base64"),
  );
  await assert.rejects(
    wrongKey.getBasket("event-private-plan"),
    /Could not decrypt/,
  );
  const movedBasket = driver([Response.json(envelope)]);
  await assert.rejects(
    movedBasket.getBasket("event-someone-else"),
    /Could not decrypt/,
  );
});

test("rejects tampered ciphertext, nonces, authentication tags, and unknown formats", async () => {
  const envelope = await encryptedPlan();
  for (const field of ["iv", "tag", "ciphertext"]) {
    const bytes = Buffer.from(envelope[field], "base64");
    bytes[0] ^= 1;
    const store = driver([
      Response.json({ ...envelope, [field]: bytes.toString("base64") }),
    ]);
    await assert.rejects(
      store.getBasket("event-private-plan"),
      /Could not decrypt/,
    );
  }
  for (const patch of [
    { _seeYaEncrypted: 2 },
    { algorithm: "aes-256-cbc" },
    { tag: "AA==" },
    { iv: null },
    { ciphertext: "not base64!" },
  ]) {
    const store = driver([Response.json({ ...envelope, ...patch })]);
    await assert.rejects(
      store.getBasket("event-private-plan"),
      /Could not decrypt/,
    );
  }
});

test("missing or invalid keys never cause plaintext uploads", async () => {
  for (const key of [
    "",
    "short",
    Buffer.alloc(16).toString("base64"),
    TEST_KEY + "!",
  ]) {
    const store = driver([], key);
    await assert.rejects(
      store.putBasket("event-private-plan", privatePlan),
      /PANTRY_ENCRYPTION_KEY/,
    );
    assert.equal(store.calls.length, 0);
  }
  const envelope = await encryptedPlan();
  const store = driver([Response.json(envelope)], "");
  await assert.rejects(
    store.getBasket("event-private-plan"),
    /Restore PANTRY_ENCRYPTION_KEY/,
  );
});

test("legacy plans remain readable and become encrypted on their next save", async () => {
  const store = driver([Response.json(privatePlan), new Response("saved")]);
  const plan = await store.getBasket("event-private-plan");
  assert.equal(plan.organiser.email, privatePlan.organiser.email);
  await store.putBasket("event-private-plan", plan);
  assert.equal(JSON.parse(store.calls[1].body)._seeYaEncrypted, 1);
});
