"use client";

import { useState } from "react";
import type { ManageEvent } from "@/lib/types";
import { formatDateShort } from "@/lib/format";
import {
  ContactListEditor,
  validContactRows,
  type ContactRow,
} from "@/components/ContactListEditor";

export function InvitePanel({
  event,
  token,
  onUpdated,
}: {
  event: ManageEvent;
  token: string;
  onUpdated: (event: ManageEvent) => void;
}) {
  const [rows, setRows] = useState<ContactRow[]>([{ name: "", email: "" }]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = validContactRows(rows);

  async function send() {
    setError(null);
    setResult(null);
    setSending(true);
    try {
      const res = await fetch(`/api/events/${event.id}/invite?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          people: valid.map((r) => ({
            name: r.name.trim(),
            email: r.email.trim(),
          })),
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send invitations");
      setResult(`Sent ${data.sent} invitation${data.sent === 1 ? "" : "s"}.`);
      setRows([{ name: "", email: "" }]);
      setMessage("");
      onUpdated(data.event);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  const invited = event.invitees.filter((i) => i.invitedAt);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Invitees get an email with the event details and a link to pick dates.
        You can also just share the public link — anyone with it can respond.
      </p>

      <ContactListEditor rows={rows} onChange={setRows} />

      <label className="block">
        <span className="eyebrow mb-1.5 block">Personal message (optional)</span>
        <textarea
          className="field"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Hey all — trying to lock down our Q3 dinner…"
        />
      </label>

      {error && (
        <p
          key={error}
          className="shake rounded-xl border-2 border-coral bg-accent-wash px-4 py-3 text-sm font-semibold text-accent-ink"
        >
          {error}
        </p>
      )}
      {result && (
        <p
          key={result}
          className="flash-in rounded-xl border-2 border-line bg-surface px-4 py-3 text-sm font-medium text-ink-soft"
        >
          {result}
        </p>
      )}

      <button
        type="button"
        onClick={send}
        className="btn btn-accent"
        disabled={sending || valid.length === 0}
      >
        {sending ? (
          <>
            <span className="spin" aria-hidden />
            Sending…
          </>
        ) : (
          `Send ${valid.length || ""} invitation${valid.length === 1 ? "" : "s"}`
        )}
      </button>

      {invited.length > 0 && (
        <div className="border-t border-line pt-4">
          <p className="eyebrow mb-2">Invited ({invited.length})</p>
          <ul className="space-y-1 text-sm">
            {invited.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>
                  {i.name}{" "}
                  <span className="text-muted">&lt;{i.email}&gt;</span>
                </span>
                <span className="font-mono text-xs text-muted">
                  {i.respondedAt
                    ? `responded ${formatDateShort(i.respondedAt.slice(0, 10))}`
                    : "no reply yet"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
