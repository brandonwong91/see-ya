/** Playful hero composition — chunky paper cards with hard shadows: a month
 *  with candidate dates, a "who's free" tally, and a venue pin. No client JS. */

const DAYS = Array.from({ length: 35 }, (_, i) => i - 2);
const CANDIDATES = new Set([9, 16, 23]);
const WINNER = 16;

const PEOPLE = [
  { ini: "AK", name: "Aisha", color: "bg-coral" },
  { ini: "MR", name: "Marco", color: "bg-sky" },
  { ini: "JD", name: "Jo", color: "bg-grape" },
  { ini: "TN", name: "Thu", color: "bg-mint" },
];

export function HeroVisual() {
  return (
    <div className="relative select-none" aria-hidden>
      {/* Calendar card */}
      <div className="card rotate-[-2deg] p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-display text-lg font-extrabold">September</span>
          <span className="chip chip-sun !py-0.5 !text-[0.6rem]">2026</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span
              key={i}
              className="font-mono text-[0.6rem] font-bold text-faint"
            >
              {d}
            </span>
          ))}
          {DAYS.map((n) => {
            const valid = n >= 1 && n <= 30;
            const isCandidate = CANDIDATES.has(n);
            const isWinner = n === WINNER;
            return (
              <span
                key={n}
                className={[
                  "flex aspect-square items-center justify-center rounded-lg text-xs font-bold",
                  !valid ? "text-transparent" : "text-ink-soft",
                  isCandidate && !isWinner
                    ? "border-2 border-grape text-grape-ink"
                    : "",
                  isWinner
                    ? "hero-stamp border-2 border-ink bg-coral text-on-accent shadow-[2px_2px_0_var(--shadow)]"
                    : "",
                ].join(" ")}
              >
                {valid ? n : "0"}
              </span>
            );
          })}
        </div>
      </div>

      {/* Availability card */}
      <div className="card floaty absolute -left-6 top-[60%] rotate-[3deg] p-3 sm:-left-12">
        <span className="chip chip-mint !py-0.5 !text-[0.6rem]">
          who&rsquo;s free · Sep 16
        </span>
        <div className="mt-2 space-y-1.5">
          {PEOPLE.map((p, i) => (
            <div key={p.ini} className="flex items-center gap-2 text-xs">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border-2 border-ink font-mono text-[0.55rem] font-bold text-on-accent ${p.color}`}
              >
                {p.ini}
              </span>
              <span className="font-semibold text-ink-soft">{p.name}</span>
              <span
                className="hero-tick ml-auto text-mint"
                style={{ animationDelay: `${1.3 + i * 0.15}s` }}
              >
                ✓
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 border-t-2 border-line pt-1.5 font-mono text-[0.65rem] font-bold text-muted">
          4 / 5 in
        </div>
      </div>

      {/* Venue pin card */}
      <div
        className="card floaty absolute -right-4 top-[6%] rotate-[5deg] p-3 sm:-right-10"
        style={{ animationDelay: "0.8s" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">📍</span>
          <div>
            <div className="text-xs font-bold">The Book Club</div>
            <div className="font-mono text-[0.6rem] text-muted">
              Leonard St, EC2A
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
