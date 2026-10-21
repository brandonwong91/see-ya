import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { loadEvent, toManageEvent } from "@/lib/events";
import { SiteHeader, SiteFooter } from "@/components/Chrome";
import { StoreError } from "@/components/StoreError";
import { ManageDashboard } from "@/components/manage/ManageDashboard";

export const metadata: Metadata = {
  title: "Manage plan — See Ya!",
  robots: { index: false, follow: false },
};

async function resolveOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  const { event, error } = await loadEvent(id);

  if (error) return <StoreError message={error} />;

  const authorised = event && token && token === event.editToken;

  return (
    <div className="min-h-screen">
      <SiteHeader cta={false} />
      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        {!authorised ? (
          <div className="card max-w-lg p-8">
            <span className="chip chip-coral">Hmm 🔒</span>
            <h1 className="mt-4 text-[clamp(1.8rem,4vw,2.75rem)]">
              This link&rsquo;s no good.
            </h1>
            <p className="mt-3 font-medium text-ink-soft">
              The organiser dashboard needs the full private link from the email
              you got when you started the plan — the one ending in{" "}
              <code className="font-mono text-sm">?token=…</code>.
            </p>
            <Link href="/" className="btn btn-ghost mt-6">
              Back home
            </Link>
          </div>
        ) : (
          <ManageDashboard
            initialEvent={toManageEvent(event)}
            token={token!}
            origin={await resolveOrigin()}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
