"use client";

import { useMemo, useState } from "react";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { ClaimRequests } from "./ClaimRequests";
import { EditEventPanel } from "./EditEventPanel";
import { InvitePanel } from "./InvitePanel";
import { MessagesPanel } from "./MessagesPanel";
import { CopyButton } from "@/components/CopyButton";
import { formatDateLong, formatDateShort } from "@/lib/format";
import type { ManageEvent } from "@/lib/types";

type Tab = "edit" | "invite" | "messages" | "activity";

export function ManageDashboard({
  initialEvent,
  token,
  origin,
}: {
  initialEvent: ManageEvent;
  token: string;
  origin: string;
}) {
  const [event, setEvent] = useState(initialEvent);
  const [tab, setTab] = useState<Tab>("edit");
  const [pendingFinalise, setPendingFinalise] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const shareUrl = `${origin}/event/${event.id}`;
  const manageUrl = `${origin}/event/${event.id}/manage?token=${token}`;

  const finalDate = event.finalizedDateId
    ? event.dateOptions.find((d) => d.id === event.finalizedDateId)
    : null;

  const responded = event.invitees.filter((i) => i.respondedAt).length;

  const bestDate = useMemo(() => {
    let top: { date: string; n: number } | null = null;
    for (const opt of event.dateOptions) {
      const n = event.invitees.filter((i) =>
        i.availableDateIds.includes(opt.id),
      ).length;
      if (!top || n > top.n) top = { date: opt.date, n };
    }
    return top;
  }, [event]);

  async function post(path: string, body: unknown) {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function confirmFinalise() {
    if (!pendingFinalise) return;
    try {
      const data = await post(
        `/api/events/${event.id}/finalize?token=${token}`,
        { dateId: pendingFinalise },
      );
      setEvent(data.event);
      setPendingFinalise(null);
      setFlash(
        `Locked in. ${data.notified} confirmation email${data.notified === 1 ? "" : "s"} sent with a calendar invite.`,
      );
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Could not finalise");
    }
  }

  async function reopen() {
    try {
      const data = await post(
        `/api/events/${event.id}/finalize?token=${token}`,
        { reopen: true },
      );
      setEvent(data.event);
      setFlash("Re-opened for scheduling.");
    } catch (err) {
      setFlash(err instanceof Error ? err.message : "Could not re-open");
    }
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`chip ${finalDate ? "chip-mint" : "chip-coral"}`}
          >
            {finalDate ? "🎉 Confirmed" : "📥 Collecting"}
          </span>
          <span className="chip chip-sun">ref {event.id}</span>
          <span className="chip chip-bubble">v{event.version}</span>
        </div>
        <h1 className="mt-3 text-[clamp(1.9rem,5vw,3.25rem)] leading-[1.02]">
          {event.title}
        </h1>
        <p className="mt-3 text-sm font-medium text-ink-soft">
          {responded} {responded === 1 ? "reply" : "replies"} so far
          {bestDate && bestDate.n > 0 && !finalDate && (
            <>
              {" · "}
              front-runner{" "}
              <strong className="text-ink">
                {formatDateLong(bestDate.date)}
              </strong>{" "}
              ({bestDate.n} in)
            </>
          )}
          {finalDate && (
            <>
              {" · "}
              <strong className="text-ink">
                {formatDateLong(finalDate.date)}
              </strong>
            </>
          )}
        </p>
      </div>

      {flash && (
        <p
          key={flash}
          className="flash-in rounded-xl border-2 border-ink bg-sun px-4 py-3 text-sm font-semibold text-on-bright"
        >
          {flash}
        </p>
      )}

      {/* Links */}
      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">Share with guests</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border-2 border-line bg-cream px-2 py-1.5 font-mono text-xs">
              {shareUrl}
            </code>
            <CopyButton value={shareUrl} label="Copy share link" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">Your private link — keep it</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border-2 border-line bg-cream px-2 py-1.5 font-mono text-xs">
              {manageUrl.replace(token, token.slice(0, 6) + "…")}
            </code>
            <CopyButton value={manageUrl} label="Copy private link" />
          </div>
        </div>
      </div>

      <ClaimRequests
        event={event}
        token={token}
        onUpdated={(updated, message) => {
          setEvent(updated);
          setFlash(message);
        }}
      />

      {/* Availability */}
      <section>
        <div className="mb-4 flex items-center justify-between border-b-2 border-line pb-2">
          <h2 className="font-display text-xl font-extrabold">Who&rsquo;s in?</h2>
          {finalDate && (
            <button
              type="button"
              onClick={reopen}
              disabled={busy}
              className="text-xs font-bold text-coral-ink underline underline-offset-2"
            >
              Re-open scheduling
            </button>
          )}
        </div>

        {pendingFinalise && (
          <div className="flash-in mb-4 rounded-2xl border-2 border-ink bg-accent-wash p-4">
            <p className="text-sm font-semibold text-accent-ink">
              Lock in{" "}
              <strong>
                {formatDateLong(
                  event.dateOptions.find((d) => d.id === pendingFinalise)!.date,
                )}
              </strong>
              ? Everyone who replied (and you) gets a confirmation with a
              calendar invite, and responses close.
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={confirmFinalise}
                disabled={busy}
                className="btn btn-accent btn-sm"
              >
                {busy ? (
                  <>
                    <span className="spin" aria-hidden />
                    Sending…
                  </>
                ) : (
                  "Yes, lock it in 🎉"
                )}
              </button>
              <button
                type="button"
                onClick={() => setPendingFinalise(null)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <AvailabilityGrid
          event={event}
          onFinalise={(id) => setPendingFinalise(id)}
          busy={busy}
        />
      </section>

      {/* Tabs */}
      <section>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["edit", "Edit plan"],
              ["invite", "Invite people"],
              [
                "messages",
                `Messages${event.comments?.length ? ` (${event.comments.length})` : ""}`,
              ],
              ["activity", "Activity"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full border-2 px-4 py-2 text-sm font-bold transition-[color,background-color,box-shadow,transform] duration-150 ${
                tab === key
                  ? "border-ink bg-grape text-on-accent shadow-[2px_2px_0_var(--shadow)]"
                  : "border-line-strong text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div key={tab} className="flash-in pt-8">
          {tab === "edit" && (
            <EditEventPanel
              event={event}
              token={token}
              onUpdated={(updated, changes, notified) => {
                setEvent(updated);
                setFlash(
                  `Saved: ${changes.join("; ")}.` +
                    (notified ? ` ${notified} re-invited.` : ""),
                );
              }}
            />
          )}
          {tab === "invite" && (
            <InvitePanel
              event={event}
              token={token}
              onUpdated={(updated) => setEvent(updated)}
            />
          )}
          {tab === "messages" && (
            <MessagesPanel
              event={event}
              token={token}
              onUpdated={(updated, message) => {
                setEvent(updated);
                setFlash(message);
              }}
            />
          )}
          {tab === "activity" && (
            <ol className="relative space-y-4 border-l-2 border-line-strong pl-5">
              {[...event.changeLog].reverse().map((c, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[1.55rem] top-1 h-3 w-3 rounded-full border-2 border-ink bg-sun" />
                  <p className="text-sm font-semibold">{c.summary}</p>
                  <p className="font-mono text-[0.65rem] font-bold text-faint">
                    v{c.version} ·{" "}
                    {formatDateShort(c.at.slice(0, 10))}{" "}
                    {new Date(c.at).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
