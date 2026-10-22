"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  recall,
  REMEMBERED_EVENT,
  type RememberedDetail,
} from "@/lib/remembered";
import type { CommentVisibility, PublicComment } from "@/lib/types";

interface You {
  id: string;
  name: string;
}

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Message thread under the plan. Anyone with the share link can read public
 *  messages; posting needs a claimed name, and each guest can choose to write
 *  to everyone or to the organiser only. */
export function EventComments({
  eventId,
  organiserName,
  initialComments,
  you,
  closed,
}: {
  eventId: string;
  organiserName: string;
  initialComments: PublicComment[];
  you: You | null;
  /** Responses are closed, so there's no guest list to claim from. */
  closed: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [me, setMe] = useState<You | null>(you);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<CommentVisibility>("public");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<CommentVisibility | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (inviteeId: string | null) => {
      const qs = inviteeId ? `?e=${encodeURIComponent(inviteeId)}` : "";
      try {
        const res = await fetch(`/api/events/${eventId}/comments${qs}`);
        if (!res.ok) return;
        const data = await res.json();
        setMe(data.you);
        setComments(data.comments);
      } catch {
        // Keep showing what we have.
      }
    },
    [eventId],
  );

  // Pick up whoever this browser claimed before.
  useEffect(() => {
    if (you) return;
    const saved = recall(eventId);
    if (saved) load(saved);
  }, [eventId, you, load]);

  // Follow claims made in the RSVP form above without a reload.
  const meId = useRef(me?.id ?? null);
  useEffect(() => {
    meId.current = me?.id ?? null;
  }, [me]);
  useEffect(() => {
    function onChange(e: Event) {
      const { detail } = e as CustomEvent<RememberedDetail>;
      if (detail.eventId !== eventId || detail.inviteeId === meId.current) {
        return;
      }
      load(detail.inviteeId);
    }
    window.addEventListener(REMEMBERED_EVENT, onChange);
    return () => window.removeEventListener(REMEMBERED_EVENT, onChange);
  }, [eventId, load]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/events/${eventId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteeId: me.id, body: body.trim(), visibility }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send your message");
      setComments(data.comments);
      setSent(visibility);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  const host = organiserName.split(" ")[0] || organiserName;

  return (
    <section id="messages" className="scroll-mt-24">
      <div className="mb-4 border-b-2 border-line pb-2">
        <h2 className="font-display text-2xl font-extrabold">Messages</h2>
      </div>

      {comments.length === 0 ? (
        <p className="text-sm font-medium text-muted">
          No messages yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`card-soft p-4 ${c.visibility === "organiser" ? "border-dashed" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-extrabold">
                  {c.mine ? "You" : c.authorName}
                </span>
                {c.fromOrganiser && (
                  <span className="chip chip-grape !py-0 !text-[0.6rem]">
                    Organiser
                  </span>
                )}
                {c.visibility === "organiser" && (
                  <span className="chip chip-sun !py-0 !text-[0.6rem]">
                    🔒 Only {host}
                  </span>
                )}
                {/* Server and browser may sit in different timezones. */}
                <span
                  suppressHydrationWarning
                  className="font-mono text-[0.65rem] font-bold text-faint"
                >
                  {when(c.createdAt)}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-line break-words text-sm font-medium text-ink-soft">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {me ? (
        <form onSubmit={post} className="mt-6 space-y-3">
          <label className="block">
            <span className="eyebrow mb-1.5 block">
              Write as {me.name}
            </span>
            <textarea
              className="field"
              rows={3}
              maxLength={2000}
              value={body}
              onChange={(ev) => {
                setBody(ev.target.value);
                setSent(null);
              }}
              placeholder={
                visibility === "public"
                  ? "Say something to everyone on the plan"
                  : `A private note for ${host}`
              }
            />
          </label>

          <fieldset>
            <legend className="sr-only">Who can see this message</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["public", "Everyone"],
                  ["organiser", `Only ${host}`],
                ] as [CommentVisibility, string][]
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
                    visibility === value
                      ? "border-ink bg-grape text-on-accent"
                      : "border-line-strong text-muted hover:text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                    className="sr-only"
                  />
                  {value === "organiser" ? "🔒 " : "💬 "}
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs font-medium text-muted">
              {visibility === "public"
                ? `Shown here to anyone with the link, and emailed to ${host} and every guest with an email.`
                : `Only ${host} sees this — we'll email it to them.`}
            </p>
          </fieldset>

          {error && (
            <p
              key={error}
              className="shake rounded-xl border-2 border-coral bg-accent-wash px-4 py-3 text-sm font-semibold text-accent-ink"
            >
              {error}
            </p>
          )}
          {sent && !error && (
            <p className="flash-in text-sm font-semibold text-ink-soft">
              📬 Sent —{" "}
              {sent === "public"
                ? "we've emailed it to everyone on the plan."
                : `we've emailed it to ${host}.`}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-accent btn-sm"
            disabled={sending || !body.trim()}
          >
            {sending ? <span className="spin" aria-hidden /> : null}
            {visibility === "public" ? "Post message" : `Send to ${host}`}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm font-medium text-muted">
          {closed
            ? "Open the personal link from your invite email to join the conversation."
            : "Tap your name on the guest list or send in your dates to join the conversation."}
        </p>
      )}
    </section>
  );
}
