"use client";

import { useState } from "react";
import { MultiDateCalendar } from "@/components/MultiDateCalendar";
import { MapPicker } from "@/components/map/MapPicker";
import type { ManageEvent, Venue } from "@/lib/types";

export function EditEventPanel({
  event,
  token,
  onUpdated,
}: {
  event: ManageEvent;
  token: string;
  onUpdated: (event: ManageEvent, changes: string[], notified: number) => void;
}) {
  const organiserDates = event.dateOptions
    .filter((d) => d.source === "organiser")
    .map((d) => d.date);
  const inviteeDates = event.dateOptions
    .filter((d) => d.source === "invitee")
    .map((d) => d.date);

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [hasTime, setHasTime] = useState(Boolean(event.time));
  const [time, setTime] = useState(event.time ?? "19:00");
  const [timezone, setTimezone] = useState(event.timezone ?? "");
  const [venue, setVenue] = useState<Venue | null>(event.venue);
  const [dates, setDates] = useState<string[]>(organiserDates);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          time: hasTime ? time : null,
          timezone: hasTime ? timezone.trim() || null : null,
          venue,
          dates,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save changes");
      if (!data.changes.length) {
        setMsg("No changes to save.");
      } else {
        setMsg(
          `Saved. ${data.changes.join("; ")}.` +
            (data.notified
              ? ` ${data.notified} ${data.notified === 1 ? "person" : "people"} re-invited by email.`
              : ""),
        );
        onUpdated(data.event, data.changes, data.notified);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <label className="block">
        <span className="eyebrow mb-1.5 block">Title</span>
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="eyebrow mb-1.5 block">Description</span>
        <textarea
          className="field"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div>
        <span className="eyebrow mb-2 block">Candidate dates</span>
        <MultiDateCalendar
          selected={dates}
          onChange={setDates}
          disabledDates={inviteeDates}
        />
        {inviteeDates.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            Dotted days were proposed by guests and stay unless they withdraw.
          </p>
        )}
        <p className="mt-1 text-xs font-medium text-coral-ink">
          Adding or removing a date re-invites everyone who responded.
        </p>
      </div>

      <div className="card-soft p-4">
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={hasTime}
            onChange={(e) => setHasTime(e.target.checked)}
            className="h-4 w-4 accent-[var(--grape)]"
          />
          Start time set
        </label>
        {hasTime && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow mb-1.5 block">Time</span>
              <input
                type="time"
                className="field"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-1.5 block">Timezone</span>
              <input
                className="field"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Europe/London"
              />
            </label>
          </div>
        )}
      </div>

      <div>
        <span className="eyebrow mb-2 block">Venue</span>
        <MapPicker value={venue} onChange={setVenue} />
      </div>

      {error && (
        <p
          key={error}
          className="shake rounded-xl border-2 border-coral bg-accent-wash px-4 py-3 text-sm font-semibold text-accent-ink"
        >
          {error}
        </p>
      )}
      {msg && (
        <p
          key={msg}
          className="flash-in rounded-xl border-2 border-line bg-surface px-4 py-3 text-sm font-medium text-ink-soft"
        >
          {msg}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        className="btn btn-accent"
        disabled={saving}
      >
        {saving ? (
          <>
            <span className="spin" aria-hidden />
            Saving…
          </>
        ) : (
          "Save changes"
        )}
      </button>
    </div>
  );
}
