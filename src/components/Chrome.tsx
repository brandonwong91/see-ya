import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, Wordmark } from "@/components/Logo";

export { Wordmark };

export function SiteHeader({
  cta = true,
  findPlan = false,
}: {
  cta?: boolean;
  findPlan?: boolean;
}) {
  return (
    <header className="border-b-2 border-ink bg-cream">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Logo />
        {(cta || findPlan) && (
          <nav aria-label="Main navigation" className="flex items-center gap-5">
            {findPlan && (
              <a
                href="/#find-plan"
                className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
              >
                Find a plan
              </a>
            )}
            {cta && (
              <span className={findPlan ? "hidden sm:inline-flex" : undefined}>
                <Link href="/create" className="btn btn-grape btn-sm">
                  Start a plan
                </Link>
              </span>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t-2 border-ink bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <Wordmark className="text-lg text-ink" />
        <p className="max-w-md leading-relaxed">
          Made with free, open tools — OpenStreetMap for venues, Pantry for
          memory, Resend for mail. No account, no fuss.
        </p>
      </div>
    </footer>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
