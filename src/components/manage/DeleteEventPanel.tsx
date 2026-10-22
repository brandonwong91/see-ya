"use client";

import { useRef, useState } from "react";
import type { ManageEvent } from "@/lib/types";

export function DeleteEventPanel({
  event,
  token,
  onDeleted,
}: {
  event: ManageEvent;
  token: string;
  onDeleted: (notified: number) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [notifyGuests, setNotifyGuests] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailable = event.invitees.filter(
    (i) => i.email && (i.respondedAt || i.invitedAt),
  ).length;

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    if (deleting) return;
    dialogRef.current?.close();
  }

  async function confirmDelete() {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/events/${event.id}?token=${token}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyGuests }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete the plan");
      dialogRef.current?.close();
      onDeleted(data.notified ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDeleting(false);
    }
  }

  return (
    <section className="card-soft flex flex-wrap items-center justify-between gap-4 p-5">
      <div>
        <h2 className="font-display text-lg font-extrabold">Delete this plan</h2>
        <p className="mt-1 text-sm text-muted">
          Removes the plan, its responses and messages for good.
        </p>
      </div>
      <button type="button" onClick={open} className="btn btn-ghost btn-sm">
        Delete plan…
      </button>

      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          if (deleting) e.preventDefault();
        }}
        onClick={(e) => {
          // Clicking the backdrop (the dialog element itself) closes it.
          if (e.target === dialogRef.current) close();
        }}
        aria-labelledby="delete-plan-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[22px] border-2 border-ink bg-surface p-0 text-ink shadow-[4px_4px_0_var(--shadow)] backdrop:bg-black/40"
      >
        <div className="p-6">
          <span className="chip chip-coral">Heads up ⚠️</span>
          <h2
            id="delete-plan-title"
            className="mt-3 font-display text-xl font-extrabold"
          >
            Delete &ldquo;{event.title}&rdquo;?
          </h2>
          <p className="mt-2 text-sm font-medium text-ink-soft">
            The share link and this dashboard will stop working, and every
            response and message is deleted. This can&rsquo;t be undone.
            We&rsquo;ll email you a confirmation.
          </p>

          {emailable > 0 && (
            <label className="mt-4 flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={notifyGuests}
                onChange={(e) => setNotifyGuests(e.target.checked)}
                disabled={deleting}
                className="mt-0.5 h-4 w-4 accent-[var(--grape)]"
              />
              <span>
                Email {emailable} {emailable === 1 ? "guest" : "guests"} that
                it&rsquo;s cancelled
              </span>
            </label>
          )}

          {error && (
            <p
              key={error}
              className="shake mt-4 rounded-xl border-2 border-coral bg-accent-wash px-4 py-3 text-sm font-semibold text-accent-ink"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="btn btn-accent btn-sm"
            >
              {deleting ? (
                <>
                  <span className="spin" aria-hidden />
                  Deleting…
                </>
              ) : (
                "Yes, delete it"
              )}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={deleting}
              className="btn btn-ghost btn-sm"
              autoFocus
            >
              Keep it
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
