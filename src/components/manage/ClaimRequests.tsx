"use client";

import { useState } from "react";
import type { ManageEvent } from "@/lib/types";

/** Pending "that's actually me" requests for names someone already claimed. */
export function ClaimRequests({
  event,
  token,
  onUpdated,
}: {
  event: ManageEvent;
  token: string;
  onUpdated: (event: ManageEvent, message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = (event.claimRequests ?? []).filter(
    (r) => r.status === "pending",
  );
  if (!pending.length) return null;

  async function resolve(requestId: string, approve: boolean) {
    setBusy(requestId);
    setError(null);
    try {
      const res = await fetch(
        `/api/events/${event.id}/claim-requests/resolve?token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId, approve }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update request");
      const request = pending.find((r) => r.id === requestId)!;
      onUpdated(
        data.event,
        approve
          ? `${request.name} is now "${request.seatName}" — we've emailed them their link.`
          : `Declined. We've let ${request.name} know.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-ink bg-accent-wash p-5">
      <h2 className="font-display text-xl font-extrabold">
        Name requests ({pending.length})
      </h2>
      <p className="mt-1 text-sm font-medium text-ink-soft">
        These people say they&rsquo;re someone on your list whose name was
        already claimed. Approving hands them the name and its answers, and
        signs out whoever claimed it first.
      </p>
      {error && (
        <p className="mt-3 text-sm font-semibold text-accent-ink">{error}</p>
      )}
      <ul className="mt-4 space-y-3">
        {pending.map((r) => (
          <li key={r.id} className="card-soft p-4">
            <p className="text-sm font-semibold">
              <strong>{r.name}</strong>{" "}
              <span className="break-all text-muted">&lt;{r.email}&gt;</span>{" "}
              wants to be <strong>{r.seatName}</strong>
            </p>
            {r.message && (
              <p className="mt-1 text-sm italic text-ink-soft">
                &ldquo;{r.message}&rdquo;
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-accent btn-sm"
                disabled={busy !== null}
                onClick={() => resolve(r.id, true)}
              >
                {busy === r.id ? (
                  <span className="spin" aria-hidden />
                ) : null}
                Approve
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy !== null}
                onClick={() => resolve(r.id, false)}
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
