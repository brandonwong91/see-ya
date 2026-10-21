"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function FindPlan() {
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [opening, startTransition] = useTransition();

  function findPlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (opening) return;
    const value = reference.trim().toLowerCase();
    if (!/^[a-z0-9]{6,16}$/.test(value)) {
      setError("Enter the 6–16 letter or number reference from your email.");
      inputRef.current?.focus();
      return;
    }
    setError(null);
    // Navigate directly: the public page handles missing plans and store errors.
    // An API preflight here would spend an extra Pantry request on every lookup.
    startTransition(() => router.push(`/event/${value}`));
  }

  return (
    <section
      id="find-plan"
      aria-labelledby={`${id}-heading`}
      className="mt-8 max-w-md scroll-mt-6 border-t border-line-strong pt-6"
    >
      <h2 id={`${id}-heading`} className="text-xl">
        Already have a plan?
      </h2>
      <p id={`${id}-hint`} className="mt-2 text-sm text-ink-soft">
        Find it with the reference from your invitation email.
      </p>
      <form onSubmit={findPlan} className="mt-4" aria-busy={opening}>
        <label
          htmlFor={`${id}-reference`}
          className="mb-2 block text-sm font-semibold"
        >
          Plan reference
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            ref={inputRef}
            id={`${id}-reference`}
            name="reference"
            type="text"
            className="field min-w-0 flex-1 !text-base"
            placeholder="e.g. k7m2p9qab3"
            value={reference}
            onChange={(e) => {
              setReference(e.target.value);
              setError(null);
            }}
            maxLength={64}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
            aria-invalid={Boolean(error)}
            disabled={opening}
            required
          />
          <button
            type="submit"
            className="btn btn-ghost min-h-12 shrink-0"
            disabled={opening}
          >
            {opening ? (
              <>
                <span className="spin" aria-hidden /> Opening…
              </>
            ) : (
              <>
                Find plan <span aria-hidden>→</span>
              </>
            )}
          </button>
        </div>
        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            className="mt-3 text-sm font-semibold text-ink"
          >
            {error}
          </p>
        )}
        {opening && (
          <p role="status" className="mt-3 text-sm text-muted">
            Opening your shared plan…
          </p>
        )}
      </form>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Organising? Use the private management link in your email to make
        changes.
      </p>
    </section>
  );
}
