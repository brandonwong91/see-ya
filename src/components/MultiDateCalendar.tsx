"use client";

import { useMemo, useState } from "react";
import { formatDateLong, todayIso } from "@/lib/format";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function monthMatrix(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function MultiDateCalendar({
  selected,
  onChange,
  min,
  disabledDates = [],
  showSelection = true,
}: {
  selected: string[];
  onChange: (dates: string[]) => void;
  /** ISO — days before this are not selectable. Defaults to today. */
  min?: string;
  /** ISO dates already proposed elsewhere — shown but locked. */
  disabledDates?: string[];
  showSelection?: boolean;
}) {
  const today = min ?? todayIso();
  const [cursor, setCursor] = useState(() => {
    const d = new Date((selected[0] ?? today) + "T12:00:00");
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const cells = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric" },
  );

  const selectedSet = new Set(selected);
  const disabledSet = new Set(disabledDates);

  function toggle(iso: string) {
    if (iso < today || disabledSet.has(iso)) return;
    const next = new Set(selected);
    if (next.has(iso)) next.delete(iso);
    else next.add(iso);
    onChange([...next].sort());
  }

  function shift(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      return {
        year: c.year + Math.floor(m / 12),
        month: ((m % 12) + 12) % 12,
      };
    });
  }

  return (
    <div
      className="card-soft overflow-hidden"
      role="group"
      aria-label="Choose possible dates"
    >
      <div className="flex items-center justify-between border-b-2 border-line px-3 py-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="grid h-11 w-11 place-items-center rounded-lg text-lg leading-none text-muted hover:bg-grape/10 hover:text-ink"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span
          className="font-display text-base font-extrabold"
          aria-live="polite"
        >
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => shift(1)}
          className="grid h-11 w-11 place-items-center rounded-lg text-lg leading-none text-muted hover:bg-grape/10 hover:text-ink"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 p-2">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-1 text-center font-mono text-[0.65rem] font-bold uppercase tracking-wider text-faint"
          >
            {w}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} className="py-2.5" />;
          const isSelected = selectedSet.has(iso);
          const isDisabled = iso < today || disabledSet.has(iso);
          const isPreProposed = disabledSet.has(iso);
          const state = isSelected
            ? "border-ink bg-coral font-bold text-on-accent shadow-[2px_2px_0_var(--shadow)]"
            : isDisabled
              ? "cursor-not-allowed text-faint/50"
              : "text-ink hover:bg-grape/10";
          return (
            <button
              key={iso}
              type="button"
              disabled={isDisabled}
              aria-pressed={isSelected}
              aria-label={`${formatDateLong(iso)}${isPreProposed ? ", already proposed" : ""}`}
              onClick={() => toggle(iso)}
              className={[
                "calendar-day relative min-h-11 rounded-lg border-2 py-2 text-sm font-semibold transition-colors",
                !isSelected ? "border-transparent" : "",
                state,
                isPreProposed ? "italic" : "",
              ].join(" ")}
              title={isPreProposed ? "Already proposed" : formatDateLong(iso)}
            >
              {Number(iso.slice(-2))}
              {isPreProposed && (
                <span className="absolute inset-x-0 bottom-0.5 mx-auto h-1 w-1 rounded-full bg-grape" />
              )}
            </button>
          );
        })}
      </div>

      {showSelection && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t-2 border-line p-2.5">
          {selected.map((iso) => (
            <button
              key={iso}
              type="button"
              onClick={() => toggle(iso)}
              className="tick-pop group inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-sun px-2.5 py-1 text-xs font-bold text-on-bright"
            >
              {formatDateLong(iso)}
              <span className="text-ink/50 group-hover:text-coral-ink">✕</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
