"use client";

import { useEffect, useMemo, useState } from "react";
import { MultiDateCalendar } from "@/components/MultiDateCalendar";
import { formatDateLong } from "@/lib/format";
import { recall, remember } from "@/lib/remembered";
import type { PublicEvent, Seat } from "@/lib/types";

type SeatPanel =
  | { kind: "emailed"; seat: Seat; sentTo?: string }
  | { kind: "taken"; seat: Seat; sentTo?: string };

interface You {
  id: string;
  name: string;
  email: string;
  availableDateIds: string[];
  note: string;
}

export function RsvpForm({
  eventId,
  initialEvent,
  you,
}: {
  eventId: string;
  initialEvent: PublicEvent;
  you: You | null;
}) {
  const [event, setEvent] = useState(initialEvent);
  const [me, setMe] = useState<You | null>(you);
  const [name, setName] = useState(you?.name ?? "");
  const [email, setEmail] = useState(you?.email ?? "");
  const [picked, setPicked] = useState<Set<string>>(
    new Set(you?.availableDateIds ?? []),
  );
  const [proposeDates, setProposeDates] = useState<string[]>([]);
  const [note, setNote] = useState(you?.note ?? "");
  const [showPropose, setShowPropose] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [claiming, setClaiming] = useState<string | null>(null);
  const [panel, setPanel] = useState<SeatPanel | null>(null);
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqMessage, setReqMessage] = useState("");

  function adopt(next: You | null) {
    setMe(next);
    setName(next?.name ?? "");
    setEmail(next?.email ?? "");
    setPicked(new Set(next?.availableDateIds ?? []));
    setNote(next?.note ?? "");
    setPanel(null);
    setError(null);
    remember(eventId, next?.id ?? null);
  }

  // A personal link (`?e=`) is remembered and then tidied out of the address
  // bar, so copying the URL into a group chat doesn't hand out your answers.
  // Without one, pick up whoever this browser claimed last time.
  useEffect(() => {
    if (you) {
      remember(eventId, you.id);
      const url = new URL(window.location.href);
      if (url.searchParams.has("e")) {
        url.searchParams.delete("e");
        window.history.replaceState(window.history.state, "", url);
      }
      return;
    }
    const saved = recall(eventId);
    if (!saved) return;
    let cancelled = false;
    fetch(`/api/events/${eventId}?e=${encodeURIComponent(saved)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.you) adopt(data.you);
        // The name was handed to someone else, or the plan changed hands.
        else remember(eventId, null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Only on first load; `adopt` is stable enough for this one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, you]);

  async function claim(seat: Seat) {
    setError(null);
    if (seat.status === "taken") {
      setPanel({ kind: "taken", seat });
      setReqName(seat.name);
      return;
    }
    if (seat.status === "emailed" && panel?.seat.seatId !== seat.seatId) {
      setPanel({ kind: "emailed", seat });
      return;
    }
    setClaiming(seat.seatId);
    try {
      const res = await fetch(`/api/events/${eventId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatId: seat.seatId }),
      });
      const data = await res.json();
      if (res.status === 409 && data.taken) {
        markSeat(seat.seatId, "taken");
        setPanel({ kind: "taken", seat: { ...seat, status: "taken" } });
        setReqName(seat.name);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Could not claim that name");
      if (data.emailed) {
        setPanel({ kind: "emailed", seat, sentTo: data.to });
        return;
      }
      markSeat(seat.seatId, "taken");
      adopt(data.you);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setClaiming(null);
    }
  }

  function markSeat(seatId: string, status: Seat["status"]) {
    setEvent((ev) => ({
      ...ev,
      roster: ev.roster.map((s) => (s.seatId === seatId ? { ...s, status } : s)),
    }));
  }

  async function requestSeat() {
    if (panel?.kind !== "taken") return;
    setError(null);
    setClaiming(panel.seat.seatId);
    try {
      const res = await fetch(`/api/events/${eventId}/claim-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seatId: panel.seat.seatId,
          name: reqName.trim(),
          email: reqEmail.trim(),
          message: reqMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send your request");
      setPanel({ ...panel, sentTo: reqEmail.trim() });
      setReqMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setClaiming(null);
    }
  }

  function forgetMe() {
    adopt(null);
    setDone(false);
  }

  const existingDates = useMemo(
    () => event.dateOptions.map((d) => d.date),
    [event.dateOptions],
  );

  const emailOk = !email.trim() || /.+@.+\..+/.test(email.trim());
  const canSubmit =
    name.trim() &&
    emailOk &&
    (picked.size > 0 || proposeDates.length > 0) &&
    !submitting;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteeId: me?.id,
          name: name.trim(),
          email: email.trim(),
          availableDateIds: [...picked],
          proposeDates,
          note: note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save your response");
      setEvent(data.event);
      setMe(data.you);
      remember(eventId, data.you.id);
      setPicked(new Set(data.you.availableDateIds));
      setProposeDates([]);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const mine = event.dateOptions.filter((d) => picked.has(d.id));
    return (
      <div className="card flash-in p-6">
        <span className="chip chip-mint">
          <span className="celebrate">🙌</span> Got it
        </span>
        <h2 className="mt-3 font-display text-2xl font-extrabold">
          Thanks, {name.split(" ")[0]}!
        </h2>
        <p className="mt-2 font-medium text-ink-soft">
          {email.trim() ? (
            <>
              A copy&rsquo;s on its way to {email}. We&rsquo;ll ping you if the
              date, time or venue changes.
            </>
          ) : (
            <>
              This browser will remember you, so come back anytime to change
              your answer. Add an email next time to get updates.
            </>
          )}
        </p>
        {mine.length > 0 && (
          <div className="mt-4">
            <p className="eyebrow mb-1">You&rsquo;re in for</p>
            <ul className="text-sm font-semibold">
              {mine.map((d) => (
                <li key={d.id}>{formatDateLong(d.date)}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          onClick={() => setDone(false)}
          className="mt-4 text-xs font-bold text-coral-ink underline underline-offset-2"
        >
          Change my answer
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-extrabold">
          {me ? `Hi ${me.name.split(" ")[0] || me.name}!` : "Can you make it?"}
        </h2>
        <p className="mt-1 text-sm font-medium text-muted">
          Tick every date that works. The organiser picks the winner.
          {me && (
            <>
              {" "}
              <button
                type="button"
                onClick={forgetMe}
                className="font-bold text-coral-ink underline underline-offset-2"
              >
                Not {me.name.split(" ")[0] || me.name}?
              </button>
            </>
          )}
        </p>
      </div>

      {!me && event.roster.length > 0 && (
        <div>
          <span className="eyebrow mb-2 block">On the guest list? Tap your name</span>
          <ul className="flex flex-wrap gap-2">
            {event.roster.map((seat) => {
              const active = panel?.seat.seatId === seat.seatId;
              return (
                <li key={seat.seatId}>
                  <button
                    type="button"
                    onClick={() => claim(seat)}
                    disabled={claiming !== null}
                    aria-pressed={active}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
                      active
                        ? "border-ink bg-grape text-on-accent"
                        : seat.status === "taken"
                          ? "border-line-strong text-muted hover:border-ink"
                          : "border-ink bg-surface hover:bg-grape/20"
                    }`}
                  >
                    {claiming === seat.seatId && <span className="spin" aria-hidden />}
                    {seat.name}
                    {seat.status === "taken" && (
                      <span className="font-mono text-[0.6rem] font-bold uppercase">
                        claimed
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {panel?.kind === "emailed" && (
            <div className="flash-in card-soft mt-3 p-4 text-sm font-medium">
              {panel.sentTo ? (
                <p>
                  📬 Sent! Check <strong>{panel.sentTo}</strong> for your
                  personal link to {panel.seat.name}&rsquo;s invite.
                </p>
              ) : (
                <>
                  <p>
                    The organiser has an email for {panel.seat.name}. We&rsquo;ll
                    send the personal link there, so only they can open it.
                  </p>
                  <button
                    type="button"
                    onClick={() => claim(panel.seat)}
                    disabled={claiming !== null}
                    className="btn btn-accent btn-sm mt-3"
                  >
                    {claiming ? <span className="spin" aria-hidden /> : null}
                    Email my link
                  </button>
                </>
              )}
            </div>
          )}

          {panel?.kind === "taken" && (
            <div className="flash-in card-soft mt-3 p-4">
              {panel.sentTo ? (
                <p className="text-sm font-medium">
                  ✉️ Request sent to the organiser. We&rsquo;ve emailed{" "}
                  <strong>{panel.sentTo}</strong> a confirmation and will let
                  you know what they decide.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    Someone has already claimed <strong>{panel.seat.name}</strong>.
                    If that&rsquo;s really you, ask the organiser to hand it
                    over — we need your email to tell you what they decide.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className="field"
                      aria-label="Your name"
                      placeholder="Your name"
                      maxLength={120}
                      value={reqName}
                      onChange={(ev) => setReqName(ev.target.value)}
                    />
                    <input
                      type="email"
                      className="field"
                      aria-label="Your email"
                      placeholder="you@example.com"
                      maxLength={200}
                      autoComplete="email"
                      value={reqEmail}
                      onChange={(ev) => setReqEmail(ev.target.value)}
                    />
                  </div>
                  <textarea
                    className="field"
                    rows={2}
                    maxLength={1000}
                    aria-label="Message for the organiser"
                    placeholder="Optional — anything that helps the organiser know it's you"
                    value={reqMessage}
                    onChange={(ev) => setReqMessage(ev.target.value)}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={requestSeat}
                      disabled={
                        claiming !== null ||
                        !reqName.trim() ||
                        !/.+@.+\..+/.test(reqEmail.trim())
                      }
                      className="btn btn-accent btn-sm"
                    >
                      {claiming ? <span className="spin" aria-hidden /> : null}
                      Ask the organiser
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanel(null)}
                      className="btn btn-ghost btn-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="mt-3 text-sm font-medium text-muted">
            Not listed? Just fill in your name below.
          </p>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow mb-1.5 block">Your name *</span>
          <input
            className="field"
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            placeholder="Full name"
            required
          />
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block">
            Your email{" "}
            <span className="normal-case tracking-normal text-faint">
              (optional — for a copy &amp; updates)
            </span>
          </span>
          <input
            type="email"
            className="field"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>
      </div>

      <div>
        <span className="eyebrow mb-2 block">Dates that work</span>
        <ul className="card-soft divide-y-2 divide-line overflow-hidden">
          {event.dateOptions.map((d) => {
            const active = picked.has(d.id);
            const count = event.tally[d.id] || 0;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => toggle(d.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left font-semibold transition-colors ${
                    active ? "bg-accent-wash" : "hover:bg-grape/10"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 flex-none place-items-center rounded-md border-2 text-xs ${
                      active
                        ? "tick-pop border-ink bg-coral text-on-accent"
                        : "border-line-strong"
                    }`}
                  >
                    {active ? "✓" : ""}
                  </span>
                  <span className="flex-1">
                    {formatDateLong(d.date)}
                    {d.source === "invitee" && (
                      <span className="ml-2 font-mono text-[0.65rem] font-bold text-faint">
                        added by {d.addedBy}
                      </span>
                    )}
                  </span>
                  <span className="chip chip-mint !py-0 !text-[0.6rem]">
                    {count} in
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        {!showPropose ? (
          <button
            type="button"
            onClick={() => setShowPropose(true)}
            className="text-sm font-bold text-coral-ink underline underline-offset-2"
          >
            + None of these work — suggest another
          </button>
        ) : (
          <div>
            <span className="eyebrow mb-2 block">
              Suggest another date (added for everyone)
            </span>
            <MultiDateCalendar
              selected={proposeDates}
              onChange={setProposeDates}
              disabledDates={existingDates}
            />
          </div>
        )}
      </div>

      <label className="block">
        <span className="eyebrow mb-1.5 block">Note for the organiser</span>
        <textarea
          className="field"
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Optional — e.g. 'can only do evenings', 'might be 15 min late'"
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

      <button type="submit" className="btn btn-accent" disabled={!canSubmit}>
        {submitting ? (
          <>
            <span className="spin" aria-hidden />
            Sending…
          </>
        ) : me?.availableDateIds.length ? (
          "Update my answer"
        ) : (
          "Send it in 🚀"
        )}
      </button>
    </form>
  );
}
