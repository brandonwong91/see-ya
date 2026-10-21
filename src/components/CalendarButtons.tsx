"use client";

import { useState } from "react";
import { googleCalendarUrl, icsPath } from "@/lib/calendar";
import { formatDateLong } from "@/lib/format";
import type { PublicEvent } from "@/lib/types";

/** Add-to-calendar for the confirmed date, or a tentative hold for any of the
 *  proposed ones while the plan is still being decided. */
export function CalendarButtons({
  event,
  shareUrl,
}: {
  event: PublicEvent;
  shareUrl: string;
}) {
  const finalDate = event.dateOptions.find(
    (d) => d.id === event.finalizedDateId,
  );
  const leading = [...event.dateOptions].sort(
    (a, b) => (event.tally[b.id] || 0) - (event.tally[a.id] || 0),
  )[0];
  const [dateId, setDateId] = useState(leading?.id ?? "");

  const option =
    finalDate ?? event.dateOptions.find((d) => d.id === dateId) ?? leading;
  if (!option) return null;

  const tentative = !finalDate;
  const google = googleCalendarUrl(event, option.date, {
    tentative,
    link: shareUrl,
  });
  const ics = icsPath(event.id, tentative ? option.id : undefined);

  return (
    <section className="card-soft p-5" aria-labelledby="calendar-heading">
      <h2 id="calendar-heading" className="eyebrow">
        {tentative ? "Pencil it in" : "Add to calendar"}
      </h2>
      {tentative ? (
        <label className="mt-2 block">
          <span className="text-sm font-medium text-muted">
            Not locked in yet — add a tentative hold for:
          </span>
          <select
            className="field mt-1.5"
            value={option.id}
            onChange={(e) => setDateId(e.target.value)}
          >
            {event.dateOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {formatDateLong(d.date)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-2 font-semibold">{formatDateLong(option.date)}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={google}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sun btn-sm"
        >
          Google Calendar
        </a>
        <a href={ics} className="btn btn-ghost btn-sm">
          Apple / Outlook (.ics)
        </a>
      </div>
    </section>
  );
}
