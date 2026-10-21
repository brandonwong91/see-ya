import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/Chrome";

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <SiteHeader cta={false} />
      <main className="mx-auto flex max-w-2xl flex-col items-start px-5 py-24">
        <span className="chip chip-coral">404 · nothing here</span>
        <h1 className="mt-5 text-[clamp(2.2rem,5.5vw,3.75rem)]">
          No plans in sight.
        </h1>
        <p className="mt-3 font-medium text-ink-soft">
          Double-check the reference in your invitation email. Plans can expire
          after 30 days without activity.
        </p>
        <Link href="/#find-plan" className="btn btn-grape mt-8">
          Try another reference
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
