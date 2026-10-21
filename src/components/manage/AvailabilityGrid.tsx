"use client";

import { formatWeekday, formatDayNum, formatMonth } from "@/lib/format";
import type { ManageEvent } from "@/lib/types";

export function AvailabilityGrid({
  event,
  onFinalise,
  busy,
}: {
  event: ManageEvent;
  onFinalise: (dateId: string) => void;
  busy: boolean;
}) {
  const responders = event.invitees.filter((i) => i.respondedAt);
  const tally: Record<string, number> = {};
  for (const opt of event.dateOptions) {
    tally[opt.id] = responders.filter((r) =>
      r.availableDateIds.includes(opt.id),
    ).length;
  }
  const best = Math.max(0, ...Object.values(tally));

  if (event.dateOptions.length === 0) {
    return <p className="text-sm text-muted">No date options yet.</p>;
  }

  return (
    <div className="card-soft overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b-2 border-line bg-surface p-2 text-left text-xs font-bold text-muted">
              {responders.length} repl{responders.length === 1 ? "y" : "ies"}
            </th>
            {event.dateOptions.map((d) => {
              const isBest = tally[d.id] === best && best > 0;
              const isFinal = event.finalizedDateId === d.id;
              return (
                <th
                  key={d.id}
                  className={`border-b-2 border-line p-2 text-center align-bottom font-normal ${
                    isFinal ? "bg-mint/25" : isBest ? "bg-sun/35" : ""
                  }`}
                >
                  <div className="font-mono text-[0.6rem] font-bold uppercase text-faint">
                    {formatWeekday(d.date)}
                  </div>
                  <div className="font-display text-lg font-extrabold leading-none">
                    {formatDayNum(d.date)}
                  </div>
                  <div className="font-mono text-[0.6rem] font-bold uppercase text-faint">
                    {formatMonth(d.date)}
                  </div>
                  {d.source === "invitee" && (
                    <div
                      className="mx-auto mt-0.5 h-1.5 w-1.5 rounded-full bg-grape"
                      title={`added by ${d.addedBy}`}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {responders.map((r) => (
            <tr key={r.id} className="border-b-2 border-line/50">
              <td className="sticky left-0 z-10 bg-surface p-2">
                <div className="font-bold">{r.name}</div>
                {r.email && <div className="text-xs text-muted">{r.email}</div>}
                {r.note && (
                  <div className="mt-0.5 max-w-[200px] text-xs italic text-faint">
                    &ldquo;{r.note}&rdquo;
                  </div>
                )}
              </td>
              {event.dateOptions.map((d) => {
                const yes = r.availableDateIds.includes(d.id);
                return (
                  <td
                    key={d.id}
                    className={`p-2 text-center text-lg ${
                      event.finalizedDateId === d.id ? "bg-mint/10" : ""
                    }`}
                  >
                    {yes ? (
                      <span className="text-mint">●</span>
                    ) : (
                      <span className="text-line-strong">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {responders.length === 0 && (
            <tr>
              <td
                colSpan={event.dateOptions.length + 1}
                className="p-4 text-center text-sm font-medium text-muted"
              >
                No replies yet — share the link below 👇
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td className="sticky left-0 z-10 bg-surface p-2 font-mono text-xs font-bold uppercase text-muted">
              In
            </td>
            {event.dateOptions.map((d) => (
              <td key={d.id} className="p-2 text-center">
                <div className="font-display text-base font-extrabold">
                  {tally[d.id]}
                </div>
              </td>
            ))}
          </tr>
          {!event.finalizedDateId && (
            <tr>
              <td className="sticky left-0 z-10 bg-surface p-2" />
              {event.dateOptions.map((d) => (
                <td key={d.id} className="p-2 text-center">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onFinalise(d.id)}
                    className="btn btn-sun btn-sm !px-3 !py-1 !text-[0.7rem]"
                  >
                    Lock
                  </button>
                </td>
              ))}
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}
