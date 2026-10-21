"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/Chrome";
import { MultiDateCalendar } from "@/components/MultiDateCalendar";
import { MapPicker } from "@/components/map/MapPicker";
import {
  ContactListEditor,
  type ContactRow,
} from "@/components/ContactListEditor";
import { createEventSchema, personSchema } from "@/lib/validation";
import { formatDateLong, formatTime } from "@/lib/format";
import type { Venue } from "@/lib/types";

const STEPS = [
  {
    label: "Plan",
    title: "What’s the plan?",
    hint: "Give it a name. We’ll send your private organiser link to your inbox.",
  },
  {
    label: "Dates",
    title: "When could it happen?",
    hint: "Pick a few possibilities. Everyone can tell you what works.",
  },
  {
    label: "Place",
    title: "Got a place in mind?",
    hint: "A favourite spot, a dropped pin, or a decision for later.",
  },
  {
    label: "People",
    title: "Who’s coming along?",
    hint: "Send an email invite now, or share your link when you’re ready.",
  },
  {
    label: "Review",
    title: "Ready to make it happen?",
    hint: "One last look. You can keep shaping the plan after you create it.",
  },
] as const;

export default function CreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [editing, setEditing] = useState(false);
  const [direction, setDirection] = useState("forward");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [hasTime, setHasTime] = useState(false);
  const [time, setTime] = useState("19:00");
  const [timezone, setTimezone] = useState("");
  const [venue, setVenue] = useState<Venue | null>(null);
  const [placeMode, setPlaceMode] = useState<"choose" | "pick" | "later">(
    "choose",
  );
  const [peopleMode, setPeopleMode] = useState<"choose" | "email" | "link">(
    "choose",
  );
  const [inviteRows, setInviteRows] = useState<ContactRow[]>([
    { name: "", email: "" },
  ]);
  const [inviteMessage, setInviteMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const submissionRef = useRef(false);
  const didNavigate = useRef(false);
  const keyboardNavigation = useRef(false);

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    if (!didNavigate.current) return;
    headingRef.current?.focus({ preventScroll: true });
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({
      top: 0,
      behavior: reduced || keyboardNavigation.current ? "instant" : "smooth",
    });
  }, [step, createdUrl]);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.focus({ preventScroll: true });
    errorRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [error]);

  useEffect(() => {
    if (!createdUrl) return;
    const timer = window.setTimeout(() => router.replace(createdUrl), 900);
    return () => window.clearTimeout(timer);
  }, [createdUrl, router]);

  const invitees =
    peopleMode === "email"
      ? inviteRows.filter((row) => row.name.trim() || row.email.trim())
      : [];

  function goTo(next: number) {
    if (submissionRef.current) return;
    didNavigate.current = true;
    setError(null);
    setDirection(next < step ? "back" : "forward");
    setStep(next);
    setFurthest((current) => Math.max(current, next));
  }

  function validateStep(): boolean {
    if (!formRef.current?.reportValidity()) return false;
    if (
      step === 0 &&
      (!title.trim() ||
        !personSchema.safeParse({ name: orgName, email: orgEmail }).success)
    ) {
      setError("Add a plan title, your name, and a valid email to continue.");
      return false;
    }
    if (step === 1 && dates.length === 0) {
      setError("Pick at least one date to give everyone a starting point.");
      return false;
    }
    if (step === 2 && placeMode === "pick" && !venue) {
      setError("Choose a place on the map, or select ‘Decide later’.");
      return false;
    }
    if (
      step === 3 &&
      peopleMode === "email" &&
      (invitees.length === 0 ||
        invitees.some((person) => !personSchema.safeParse(person).success))
    ) {
      setError(
        "Add a name and valid email for each guest, or choose to share a link instead.",
      );
      return false;
    }
    return true;
  }

  function nextStep() {
    if (
      (step === 2 && placeMode === "choose") ||
      (step === 3 && peopleMode === "choose")
    )
      return;
    if (validateStep()) goTo(editing ? 4 : Math.min(step + 1, 4));
  }
  function editStep(next: number) {
    setEditing(true);
    goTo(next);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < 4) {
      nextStep();
      return;
    }
    if (submissionRef.current) return;
    const parsed = createEventSchema.safeParse({
      title,
      description,
      organiser: { name: orgName, email: orgEmail },
      dates,
      time: hasTime ? time : null,
      timezone: hasTime ? timezone || null : null,
      venue: placeMode === "pick" ? venue : null,
      invitees,
      inviteMessage,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const target = ["dates", "time", "timezone"].includes(
        String(issue.path[0]),
      )
        ? 1
        : issue.path[0] === "venue"
          ? 2
          : ["invitees", "inviteMessage"].includes(String(issue.path[0]))
            ? 3
            : 0;
      editStep(target);
      setError(issue.message);
      return;
    }
    submissionRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error || "Could not create the plan. Please try again.",
        );
      didNavigate.current = true;
      setCreatedUrl(data.manageUrl);
    } catch (err) {
      submissionRef.current = false;
      setSubmitting(false);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  const choosing =
    (step === 2 && placeMode === "choose") ||
    (step === 3 && peopleMode === "choose");
  const content = STEPS[step];

  return (
    <div
      className="create-flow min-h-svh"
      onPointerDownCapture={() => {
        keyboardNavigation.current = false;
      }}
      onKeyDownCapture={() => {
        keyboardNavigation.current = true;
      }}
      data-keyboard={keyboardNavigation.current || undefined}
    >
      <SiteHeader cta={false} />
      <main className="mx-auto max-w-5xl px-5 pb-36 pt-5 sm:px-8 sm:pt-8">
        {createdUrl ? (
          <div className="mx-auto max-w-lg py-16 text-center" role="status">
            <div className="plan-success mx-auto mb-6 grid size-20 place-items-center rounded-full border-2 border-ink bg-mint">
              <CheckIcon className="size-10" />
            </div>
            <h1 ref={headingRef} tabIndex={-1} className="text-3xl sm:text-4xl">
              Your plan is out in the world.
            </h1>
            <p className="mt-4 text-ink-soft">
              Your links are on their way to {orgEmail}. Opening your dashboard…
            </p>
            <Link href={createdUrl} className="btn btn-accent mt-8">
              Go to my plan <span aria-hidden>↗</span>
            </Link>
          </div>
        ) : (
          <>
            <nav
              aria-label="Plan creation steps"
              className="mb-7 max-w-xl sm:mb-9"
            >
              <div className="mb-4 flex items-center justify-between text-xs font-semibold text-muted">
                <span>NEW PLAN</span>
                <span>
                  Step {step + 1} of {STEPS.length}
                </span>
              </div>
              <ol className="grid grid-cols-5 gap-1">
                {STEPS.map((item, index) => (
                  <li key={item.label}>
                    <button
                      type="button"
                      disabled={index > furthest || submitting}
                      aria-current={step === index ? "step" : undefined}
                      onClick={() => {
                        if (index <= step || validateStep()) goTo(index);
                      }}
                      className={`step-link ${step === index ? "is-current" : ""} ${index < step ? "is-complete" : ""}`}
                    >
                      <span className="step-number">
                        {index < step ? (
                          <CheckIcon className="size-3.5" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <div
                className="mt-3 h-1 overflow-hidden rounded-full bg-line"
                aria-hidden
              >
                <div
                  className="step-progress h-full origin-left bg-ink"
                  style={{ transform: `scaleX(${(step + 1) / STEPS.length})` }}
                />
              </div>
            </nav>

            <div className="grid gap-14 lg:grid-cols-[minmax(0,36rem)_1fr]">
              <form
                ref={formRef}
                onSubmit={submit}
                noValidate
                aria-busy={submitting}
              >
                <section
                  key={step}
                  className="create-step"
                  data-direction={direction}
                  aria-labelledby="step-heading"
                >
                  <h1
                    id="step-heading"
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-[2rem] sm:text-[2.6rem]"
                  >
                    {content.title}
                  </h1>
                  <p className="mb-7 mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
                    {content.hint}
                  </p>
                  {step === 0 && (
                    <div className="space-y-5">
                      <Field label="Plan title">
                        <input
                          name="title"
                          className="field"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Dinner, a day out, something good…"
                          maxLength={160}
                          required
                          enterKeyHint="next"
                        />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Your name">
                          <input
                            name="organiserName"
                            autoComplete="name"
                            className="field"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            placeholder="What should we call you?"
                            maxLength={120}
                            required
                            enterKeyHint="next"
                          />
                        </Field>
                        <Field label="Your email">
                          <input
                            name="organiserEmail"
                            type="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            className="field"
                            value={orgEmail}
                            onChange={(e) => setOrgEmail(e.target.value)}
                            placeholder="you@example.com"
                            maxLength={200}
                            required
                            enterKeyHint="go"
                          />
                        </Field>
                      </div>
                      <details
                        className="optional-detail"
                        open={description ? true : undefined}
                      >
                        <summary>
                          Add a description{" "}
                          <span className="font-normal text-muted">
                            (optional)
                          </span>
                          <span aria-hidden>+</span>
                        </summary>
                        <Field label="A little more about the plan">
                          <textarea
                            name="description"
                            className="field mt-2"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What to bring, what to expect…"
                            maxLength={4000}
                            rows={3}
                          />
                        </Field>
                      </details>
                    </div>
                  )}
                  {step === 1 && (
                    <div className="space-y-4">
                      <MultiDateCalendar
                        selected={dates}
                        showSelection={false}
                        onChange={(next) => {
                          if (next.length > 20) {
                            setError("Choose up to 20 dates.");
                            return;
                          }
                          setDates(next);
                          setError(null);
                        }}
                      />
                      <p className="text-sm font-semibold" aria-live="polite">
                        {dates.length
                          ? `${dates.length} date${dates.length === 1 ? "" : "s"} selected. Tap again to remove.`
                          : "Choose at least one date."}
                      </p>
                      <details
                        className="optional-detail"
                        open={hasTime || undefined}
                      >
                        <summary>
                          Add a start time{" "}
                          <span className="font-normal text-muted">
                            (optional)
                          </span>
                          <span aria-hidden>+</span>
                        </summary>
                        <div className="grid gap-4 pt-3 sm:grid-cols-2">
                          <Field label="Start time">
                            <input
                              type="time"
                              className="field"
                              value={hasTime ? time : ""}
                              onChange={(e) => {
                                setTime(e.target.value);
                                setHasTime(Boolean(e.target.value));
                              }}
                            />
                          </Field>
                          <Field label="Timezone">
                            <input
                              className="field"
                              value={timezone}
                              maxLength={80}
                              onChange={(e) => setTimezone(e.target.value)}
                              placeholder="e.g. Asia/Singapore"
                            />
                          </Field>
                        </div>
                        {hasTime && (
                          <button
                            type="button"
                            onClick={() => setHasTime(false)}
                            className="mt-2 min-h-11 text-sm font-semibold underline underline-offset-4"
                          >
                            Remove start time
                          </button>
                        )}
                      </details>
                    </div>
                  )}
                  {step === 2 && (
                    <div className="space-y-4">
                      {placeMode !== "pick" ? (
                        <Choice
                          icon="pin"
                          title="Add a place"
                          hint="Search for a spot or drop a pin on the map."
                          onClick={() => setPlaceMode("pick")}
                        />
                      ) : (
                        <div className="inline-reveal">
                          <MapPicker value={venue} onChange={setVenue} />
                        </div>
                      )}
                      <Choice
                        icon="later"
                        title="Decide later"
                        hint="Keep it open. Add a venue from your dashboard."
                        onClick={() => {
                          setPlaceMode("later");
                          setVenue(null);
                          goTo(editing ? 4 : 3);
                        }}
                        compact={placeMode === "pick"}
                      />
                    </div>
                  )}
                  {step === 3 && (
                    <div className="space-y-5">
                      {peopleMode !== "email" ? (
                        <Choice
                          icon="mail"
                          title="Invite by email"
                          hint="Your guests get a link to choose their dates."
                          onClick={() => setPeopleMode("email")}
                        />
                      ) : (
                        <div className="inline-reveal space-y-5">
                          <ContactListEditor
                            rows={inviteRows}
                            onChange={setInviteRows}
                          />
                          <details
                            className="optional-detail"
                            open={inviteMessage ? true : undefined}
                          >
                            <summary>
                              Add a personal message <span aria-hidden>+</span>
                            </summary>
                            <Field label="Message for your guests">
                              <textarea
                                className="field mt-2"
                                rows={3}
                                maxLength={2000}
                                value={inviteMessage}
                                onChange={(e) =>
                                  setInviteMessage(e.target.value)
                                }
                                placeholder="Hey everyone, let’s find a date…"
                              />
                            </Field>
                          </details>
                        </div>
                      )}
                      <Choice
                        icon="link"
                        title="I’ll share a link myself"
                        hint="Send it to the group chat. You can email guests later too."
                        onClick={() => {
                          setPeopleMode("link");
                          goTo(4);
                        }}
                        compact={peopleMode === "email"}
                      />
                    </div>
                  )}
                  {step === 4 && (
                    <div className="space-y-5">
                      <div className="invite-preview relative overflow-hidden rounded-2xl border-2 border-ink bg-surface p-5 sm:p-7">
                        <span className="chip chip-mint mb-4">
                          You’re invited
                        </span>
                        <h2 className="break-words text-2xl sm:text-3xl">
                          {title}
                        </h2>
                        <p className="mt-2 text-sm text-muted">
                          A plan by {orgName}
                        </p>
                        {description && (
                          <p className="mt-4 whitespace-pre-line break-words text-sm text-ink-soft">
                            {description}
                          </p>
                        )}
                        <div className="mt-5 border-t border-dashed border-line-strong pt-4 text-sm font-semibold">
                          <p>
                            {dates.length} possible date
                            {dates.length === 1 ? "" : "s"}
                            {hasTime ? ` · ${formatTime(time)}` : ""}
                          </p>
                          <p className="mt-1 text-muted">
                            {placeMode === "pick" && venue
                              ? venue.name
                              : "Somewhere good. Place to be decided."}
                          </p>
                        </div>
                      </div>
                      <div className="divide-y divide-line-strong">
                        <ReviewRow label="The plan" onEdit={() => editStep(0)}>
                          <p className="break-all">
                            Your private link goes to {orgEmail}.
                          </p>
                        </ReviewRow>
                        <ReviewRow
                          label="Dates & time"
                          onEdit={() => editStep(1)}
                        >
                          <p>{dates.map(formatDateLong).join(" · ")}</p>
                          {hasTime && (
                            <p className="mt-1">
                              {formatTime(time)}
                              {timezone ? ` · ${timezone}` : ""}
                            </p>
                          )}
                        </ReviewRow>
                        <ReviewRow label="Place" onEdit={() => editStep(2)}>
                          <p>
                            {placeMode === "pick" && venue
                              ? `${venue.name}${venue.address ? `, ${venue.address}` : ""}`
                              : "You’ll decide later."}
                          </p>
                        </ReviewRow>
                        <ReviewRow label="Guests" onEdit={() => editStep(3)}>
                          <p>
                            {invitees.length
                              ? `${invitees.length} email invite${invitees.length === 1 ? "" : "s"} will be sent.`
                              : "You’ll get a link to share wherever you like."}
                          </p>
                          {invitees.length > 0 && (
                            <p className="mt-1 break-words">
                              {invitees
                                .map(
                                  (person) =>
                                    `${person.name} (${person.email})`,
                                )
                                .join(", ")}
                            </p>
                          )}
                          {inviteMessage && peopleMode === "email" && (
                            <p className="mt-2 whitespace-pre-line break-words">
                              “{inviteMessage}”
                            </p>
                          )}
                        </ReviewRow>
                      </div>
                    </div>
                  )}
                </section>
                {error && (
                  <p
                    ref={errorRef}
                    tabIndex={-1}
                    role="alert"
                    className="mt-5 rounded-xl border border-coral bg-accent-wash p-4 text-sm font-semibold"
                  >
                    {error}
                  </p>
                )}
                <div className="create-actions fixed inset-x-0 bottom-0 z-[1300] border-t-2 border-line-strong bg-cream px-5 pt-3 sm:px-8">
                  <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                    {step > 0 ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => goTo(step - 1)}
                        className="create-back min-h-12 px-2 text-sm font-semibold"
                      >
                        <span aria-hidden>←</span> Back
                      </button>
                    ) : (
                      <Link
                        href="/"
                        className="create-back min-h-12 px-2 text-sm font-semibold"
                      >
                        Cancel
                      </Link>
                    )}
                    <div className="flex items-center gap-5">
                      <span
                        className="hidden text-xs text-muted sm:block"
                        aria-live="polite"
                      >
                        {step === 4
                          ? "Make it official. Change it anytime."
                          : "A little closer to seeing everyone."}
                      </span>
                      {!choosing && (
                        <button
                          type="submit"
                          className="btn btn-accent min-h-12 min-w-40"
                          disabled={submitting}
                        >
                          {submitting ? (
                            <>
                              <span className="spin" aria-hidden /> Creating
                              your plan…
                            </>
                          ) : step === 4 ? (
                            <>
                              Create plan <span aria-hidden>↗</span>
                            </>
                          ) : editing ? (
                            <>
                              Save & review <span aria-hidden>→</span>
                            </>
                          ) : (
                            <>
                              Continue <span aria-hidden>→</span>
                            </>
                          )}
                        </button>
                      )}
                      {choosing && (
                        <span className="py-3 text-sm font-medium text-muted">
                          Choose an option to continue
                        </span>
                      )}
                    </div>
                  </div>
                  {submitting && (
                    <p
                      role="status"
                      className="mx-auto mt-2 max-w-5xl text-right text-xs text-muted"
                    >
                      Saving your plan. This can take a moment.
                    </p>
                  )}
                </div>
              </form>
              <aside
                className="hidden pt-2 lg:block"
                aria-label="Your plan at a glance"
              >
                <div className="sticky top-8 border-t-2 border-ink pt-5">
                  <span className="eyebrow">A little less planning.</span>
                  <p className="mt-2 font-display text-3xl font-bold leading-tight">
                    A little more
                    <br />
                    seeing everyone.
                  </p>
                  <div className="mt-8 flex items-center gap-3 text-sm text-ink-soft">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mint">
                      <CheckIcon className="size-5" />
                    </span>
                    <p>
                      No account to create.
                      <br />
                      Just a plan worth making.
                    </p>
                  </div>
                  {title && (
                    <div className="mt-8 border-t border-dashed border-line-strong pt-5">
                      <p className="break-words font-semibold">{title}</p>
                      <p className="mt-1 text-sm text-muted">
                        {dates.length
                          ? `${dates.length} possible date${dates.length === 1 ? "" : "s"}`
                          : "The start of something good."}
                      </p>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
function Choice({
  icon,
  title,
  hint,
  onClick,
  compact = false,
}: {
  icon: "pin" | "later" | "mail" | "link";
  title: string;
  hint: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`choice-button group flex w-full items-center gap-4 text-left ${compact ? "is-compact" : ""}`}
    >
      <span
        className={`grid size-12 shrink-0 place-items-center rounded-xl ${icon === "later" || icon === "link" ? "bg-grape" : "bg-mint"}`}
      >
        <ChoiceIcon kind={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-muted">
          {hint}
        </span>
      </span>
      <span className="choice-arrow text-xl" aria-hidden>
        →
      </span>
    </button>
  );
}
function ReviewRow({
  label,
  children,
  onEdit,
}: {
  label: string;
  children: ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-start gap-4 py-4">
      <div className="min-w-0 flex-1">
        <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal">
          {label}
        </h3>
        <div className="text-sm leading-relaxed text-muted">{children}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="min-h-11 px-2 text-sm font-semibold underline underline-offset-4"
        aria-label={`Edit ${label.toLowerCase()}`}
      >
        Edit
      </button>
    </div>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}
function ChoiceIcon({ kind }: { kind: "pin" | "later" | "mail" | "link" }) {
  const paths = {
    pin: (
      <>
        <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    later: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    link: (
      <>
        <path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6"
      aria-hidden="true"
    >
      {paths[kind]}
    </svg>
  );
}
