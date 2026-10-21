import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { HeroVisual } from "@/components/HeroVisual";
import { SiteFooter, SiteHeader } from "@/components/Chrome";
import { FindPlan } from "@/components/FindPlan";

const STEPS = [
  {
    emoji: "🗓️",
    title: "Toss out dates",
    body: "Name the plan, tap a few dates that could work, and drop a pin on the venue. Add a time if you've got one — totally optional.",
    color: "bg-coral text-on-accent",
  },
  {
    emoji: "✅",
    title: "Everyone ticks",
    body: "Share one link. Friends add their name and email, tick what works, or throw in a new date. Watch the winner rise to the top.",
    color: "bg-grape text-on-accent",
  },
  {
    emoji: "🎉",
    title: "Lock it in",
    body: "Pick the date. Everyone gets a confirmation with a calendar file attached — and if plans shift later, fresh invites go out on their own.",
    color: "bg-mint text-on-accent",
  },
];

const FEATURES = [
  {
    emoji: "📍",
    k: "Venue, pinned",
    v: "Search or tap the map to place the spot. OpenStreetMap under the hood — no Google, no API key, no creepy tracking.",
    bg: "bg-sun",
  },
  {
    emoji: "👀",
    k: "See who's free",
    v: "A colourful grid shows exactly who can make which date, with the best option glowing right at you.",
    bg: "bg-bubble",
  },
  {
    emoji: "📬",
    k: "Everyone keeps a copy",
    v: "Organiser and every guest gets the plan emailed to them — a real record, tied to one tidy reference code.",
    bg: "bg-sky",
  },
  {
    emoji: "🔄",
    k: "Change once, tell all",
    v: "Move the date, nudge the time, switch the venue — updated invites fly out to everyone who already replied.",
    bg: "bg-coral",
  },
];

const TICKER = [
  "toss out dates",
  "drop a pin",
  "see who's free",
  "lock it in",
  "auto invites",
  "no accounts",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader findPlan />

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl overflow-visible px-5 pb-16 pt-12 sm:pt-16">
        {/* floaty stickers */}
        <span
          className="floaty absolute left-[3%] top-24 hidden text-4xl sm:block"
          style={{ ["--r" as string]: "-12deg" }}
          aria-hidden
        >
          🎈
        </span>
        <span
          className="floaty absolute right-[4%] top-8 hidden text-4xl md:block"
          style={{ ["--r" as string]: "10deg", animationDelay: "1.2s" }}
          aria-hidden
        >
          ✨
        </span>

        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Reveal>
              <span className="chip chip-mint">
                👋 the group-chat plan, sorted
              </span>
            </Reveal>
            <Reveal delay={70}>
              <h1 className="mt-5 text-[clamp(2.9rem,7.5vw,5.5rem)] leading-[0.98]">
                Sort the date.
                <br />
                <span className="squiggle">See ya</span> there.
              </h1>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-6 max-w-md text-lg font-medium leading-relaxed text-ink-soft">
                See Ya! is the fun little tool for whoever's organising. Throw out
                some dates, map the spot, and let everyone pick. Plans wobble —
                the invites keep up.
              </p>
            </Reveal>
            <Reveal delay={210}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/create" className="btn btn-accent">
                  Start a plan — free
                </Link>
                <a href="#how" className="btn btn-ghost">
                  How it works
                </a>
              </div>
            </Reveal>
            <FindPlan />
          </div>

          <Reveal delay={180} className="pl-4 sm:pl-10 lg:pl-0">
            <HeroVisual />
          </Reveal>
        </div>
      </section>

      {/* ─── Marquee ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden border-y-2 border-ink bg-grape py-3">
        <div className="marquee-track">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className="flex items-center">
              {TICKER.map((word, j) => (
                <span key={j} className="flex items-center">
                  <span className="px-5 font-display text-sm font-bold uppercase tracking-wide text-on-accent">
                    {word}
                  </span>
                  <span className="text-sun">★</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ─── How it works ─────────────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
        <Reveal>
          <span className="eyebrow">Three taps, tops</span>
          <h2 className="mt-3 max-w-2xl text-[clamp(2rem,4.5vw,3.25rem)]">
            From &ldquo;we should hang&rdquo; to a date in the diary.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 90}>
              <div className="card lift flex h-full flex-col p-6">
                <span
                  className={`lift-icon mb-4 grid h-14 w-14 place-items-center rounded-2xl border-2 border-ink text-2xl ${s.color}`}
                >
                  {s.emoji}
                </span>
                <span className="font-mono text-xs font-bold text-muted">
                  0{i + 1}
                </span>
                <h3 className="mt-1 text-2xl">{s.title}</h3>
                <p className="mt-2 font-medium leading-relaxed text-ink-soft">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────── */}
      <section className="border-y-2 border-ink bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
          <Reveal>
            <span className="eyebrow">What&rsquo;s in the box</span>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <Reveal key={f.k} delay={i * 70}>
                <div className="card lift flex gap-4 p-6">
                  <span
                    className={`lift-icon grid h-12 w-12 flex-none place-items-center rounded-2xl border-2 border-ink text-xl ${f.bg}`}
                  >
                    {f.emoji}
                  </span>
                  <div>
                    <h3 className="text-xl">{f.k}</h3>
                    <p className="mt-1.5 font-medium leading-relaxed text-ink-soft">
                      {f.v}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stateful callout ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)]">
              Every plan has a{" "}
              <span className="squiggle text-grape-ink">memory.</span>
            </h2>
          </Reveal>
          <Reveal delay={110}>
            <div className="space-y-4 font-medium text-ink-soft">
              <p className="leading-relaxed">
                State lives in a Pantry basket with its own reference code. No
                sign-up, no password — you keep a private link, guests get a
                public one.
              </p>
              <p className="leading-relaxed">
                Bump the venue across town, push the start back an hour, add a
                fourth date — See Ya! spots the change and fires a fresh invite
                to everyone already on the list, reason and all.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="chip chip-sun">ref · k7m2p9qab3</span>
                <span className="chip chip-bubble">v4</span>
                <span className="chip chip-sky">
                  venue moved → 12 re-invited
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Closing CTA ─────────────────────────────────────────────── */}
      <section className="border-y-2 border-ink bg-sun text-on-bright">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-20 sm:py-24">
          <Reveal>
            <h2 className="max-w-3xl text-[clamp(2.2rem,5.5vw,4rem)] leading-[1.02] text-on-bright">
              Quit the &ldquo;what about Thursday?&rdquo; group chat.
            </h2>
          </Reveal>
          <Reveal delay={110}>
            <Link href="/create" className="btn btn-grape">
              Start a plan — free
            </Link>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
