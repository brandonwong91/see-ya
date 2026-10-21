import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/Chrome";

/** Shown when the data store (Pantry) can't be reached or is misconfigured —
 *  a friendly stand-in for a raw 500. */
export function StoreError({ message }: { message: string }) {
  return (
    <div className="min-h-screen">
      <SiteHeader cta={false} />
      <main className="mx-auto flex max-w-2xl flex-col items-start px-5 py-24">
        <span className="chip chip-coral">⚠️ hiccup</span>
        <h1 className="mt-5 text-[clamp(2rem,5vw,3.25rem)]">
          Couldn&rsquo;t load that.
        </h1>
        <p className="mt-3 font-medium text-ink-soft">{message}</p>
        <Link href="/" className="btn btn-grape mt-8">
          Back home
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
