"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MultiDateCalendar } from "@/components/MultiDateCalendar";
import { formatDateLong } from "@/lib/format";
import type { PublicEvent } from "@/lib/types";

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
  const router = useRouter();
  const [event, setEvent] = useState(initialEvent);
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

  const existingDates = useMemo(
    () => event.dateOptions.map((d) => d.date),
    [event.dateOptions],
  );

  const canSubmit =
    name.trim() &&
    /.+@.+\..+/.test(email) &&
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
      setPicked(new Set(data.you.availableDateIds));
      setProposeDates([]);
      setDone(true);
      router.replace(`/event/${eventId}?e=${data.you.id}`, { scroll: false });
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
          A copy&rsquo;s on its way to {email}. We&rsquo;ll ping you if the date,
          time or venue changes.
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
          {you ? "Tweak your answer" : "Can you make it?"}
        </h2>
        <p className="mt-1 text-sm font-medium text-muted">
          Tick every date that works. The organiser picks the winner.
        </p>
      </div>

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
          <span className="eyebrow mb-1.5 block">Your email *</span>
          <input
            type="email"
            className="field"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="you@example.com"
            required
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
        ) : you ? (
          "Update my answer"
        ) : (
          "Send it in 🚀"
        )}
      </button>
    </form>
  );
}
