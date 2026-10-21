"use client";

import { useState } from "react";
import type { ManageEvent } from "@/lib/types";

/** Every message on the plan, private ones included, plus a box for the
 *  organiser to post to everyone. Private messages are answered by email. */
export function MessagesPanel({
  event,
  token,
  onUpdated,
}: {
  event: ManageEvent;
  token: string;
  onUpdated: (event: ManageEvent, message: string) => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comments = [...(event.comments ?? [])].reverse();
  const emailOf = (authorId: string | null) =>
    authorId ? event.invitees.find((i) => i.id === authorId)?.email ?? "" : "";

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch(
        `/api/events/${event.id}/comments?token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: body.trim(), visibility: "public" }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not post your message");
      setBody("");
      onUpdated(data.event, "Posted — we've emailed it to every guest with an email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={post} className="space-y-3">
        <label className="block">
          <span className="eyebrow mb-1.5 block">Message everyone</span>
          <textarea
            className="field"
            rows={3}
            maxLength={2000}
            value={body}
            onChange={(ev) => setBody(ev.target.value)}
            placeholder="Shown on the plan and emailed to every guest with an email"
          />
        </label>
        {error && (
          <p className="text-sm font-semibold text-accent-ink">{error}</p>
        )}
        <button
          type="submit"
          className="btn btn-accent btn-sm"
          disabled={sending || !body.trim()}
        >
          {sending ? <span className="spin" aria-hidden /> : null}
          Post to everyone
        </button>
      </form>

      {comments.length === 0 ? (
        <p className="text-sm font-medium text-muted">
          No messages yet. Guests can write once they&rsquo;ve claimed their
          name — to everyone, or privately to you.
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const email = emailOf(c.authorId);
            return (
              <li
                key={c.id}
                className={`card-soft p-4 ${c.visibility === "organiser" ? "border-dashed" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-extrabold">
                    {c.authorId === null ? "You" : c.authorName}
                  </span>
                  <span
                    className={`chip !py-0 !text-[0.6rem] ${c.visibility === "organiser" ? "chip-sun" : "chip-mint"}`}
                  >
                    {c.visibility === "organiser" ? "🔒 Private" : "Everyone"}
                  </span>
                  <span className="font-mono text-[0.65rem] font-bold text-faint">
                    {new Date(c.createdAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-line break-words text-sm font-medium text-ink-soft">
                  {c.body}
                </p>
                {c.visibility === "organiser" && (
                  <p className="mt-2 text-xs font-medium text-muted">
                    {email ? (
                      <a
                        href={`mailto:${email}?subject=${encodeURIComponent(`Re: ${event.title}`)}`}
                        className="font-bold text-coral-ink underline underline-offset-2"
                      >
                        Reply by email
                      </a>
                    ) : (
                      "No email on file — reply to everyone above, or reach them another way."
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
