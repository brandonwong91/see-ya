import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  loadEvent,
  shareSummary,
  toPublicEvent,
  visibleComments,
} from "@/lib/events";
import { publicUrl } from "@/lib/email";
import { formatDateLong, formatTime } from "@/lib/format";
import { SiteHeader, SiteFooter } from "@/components/Chrome";
import { StoreError } from "@/components/StoreError";
import { MapView } from "@/components/map/MapView";
import { RsvpForm } from "@/components/RsvpForm";
import { CalendarButtons } from "@/components/CalendarButtons";
import { EventComments } from "@/components/EventComments";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { event } = await loadEvent(id);
  if (!event) return { title: "Plan not found — See Ya!" };
  const title = `${event.title} — See Ya!`;
  const description = shareSummary(event);
  return {
    title,
    description,
    openGraph: {
      title: event.title,
      description,
      type: "website",
      siteName: "See Ya!",
      url: `/event/${event.id}`,
    },
    twitter: { card: "summary_large_image", title: event.title, description },
  };
}

export default async function PublicEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { id } = await params;
  const { e: inviteeId } = await searchParams;
  const { event: record, error } = await loadEvent(id);
  if (error) return <StoreError message={error} />;
  if (!record) notFound();

  const event = toPublicEvent(record);
  const you = inviteeId
    ? record.invitees.find((i) => i.id === inviteeId) ?? null
    : null;

  const finalDate = event.finalizedDateId
    ? event.dateOptions.find((d) => d.id === event.finalizedDateId)
    : null;

  return (
    <div className="min-h-screen">
      <SiteHeader cta={false} />

      <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <span className="chip chip-grape">
          👋 {event.organiserName} invited you · ref {event.id}
        </span>
        <h1 className="mt-4 text-[clamp(2.1rem,5.5vw,3.75rem)] leading-[1.02]">
          {event.title}
        </h1>
        {event.description && (
          <p className="mt-4 max-w-xl whitespace-pre-line font-medium text-ink-soft">
            {event.description}
          </p>
        )}

        {/* Facts */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="card-soft p-5">
            <span className="eyebrow">
              {finalDate ? "It's happening" : "Pick your dates"}
            </span>
            {finalDate ? (
              <p className="mt-2 font-display text-2xl font-extrabold">
                {formatDateLong(finalDate.date)}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {event.dateOptions.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <span className="font-semibold">
                      {formatDateLong(d.date)}
                    </span>
                    <span className="chip chip-mint !py-0 !text-[0.6rem]">
                      {event.tally[d.id] || 0} in
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {event.time && (
              <p className="mt-3 text-sm font-semibold text-ink-soft">
                ⏰ Starts {formatTime(event.time)}
                {event.timezone ? ` · ${event.timezone}` : ""}
              </p>
            )}
          </div>

          <div className="card-soft p-5">
            <span className="eyebrow">Where</span>
            {event.venue ? (
              <div className="mt-2">
                <p className="mb-2 font-bold">📍 {event.venue.name}</p>
                <MapView venue={event.venue} />
              </div>
            ) : (
              <p className="mt-2 text-sm font-medium text-muted">
                To be confirmed.
              </p>
            )}
          </div>
        </div>

        {/* RSVP / finalised */}
        <div className="mt-12">
          {finalDate ? (
            <div className="card p-6">
              <span className="chip chip-mint">🎉 Confirmed</span>
              <h2 className="mt-3 font-display text-2xl font-extrabold">
                See ya on {formatDateLong(finalDate.date)}
                {event.time ? `, ${formatTime(event.time)}` : ""}!
              </h2>
              <p className="mt-2 font-medium text-ink-soft">
                If you responded, a calendar invite is already in your inbox.
              </p>
              <a
                href={`/api/events/${event.id}/ics`}
                className="btn btn-sun mt-4"
              >
                Add to calendar
              </a>
            </div>
          ) : (
            <RsvpForm
              eventId={event.id}
              initialEvent={event}
              you={
                you
                  ? {
                      id: you.id,
                      name: you.name,
                      email: you.email,
                      availableDateIds: you.availableDateIds,
                      note: you.note,
                    }
                  : null
              }
            />
          )}
        </div>

        {event.dateOptions.length > 0 && (
          <div className="mt-12">
            <CalendarButtons event={event} shareUrl={publicUrl(record)} />
          </div>
        )}

        <div className="mt-12">
          <EventComments
            eventId={event.id}
            organiserName={event.organiserName}
            initialComments={visibleComments(record, you?.id ?? null)}
            you={you ? { id: you.id, name: you.name } : null}
            closed={Boolean(finalDate)}
          />
        </div>

        <p className="mt-10 text-xs font-medium text-muted">
          Sorted with{" "}
          <Link href="/" className="font-bold text-grape-ink underline underline-offset-2">
            See Ya!
          </Link>
          . Names on the guest list and messages posted to everyone are visible
          to anyone with this link; your email and answers go only to the
          organiser, to send you the invite and any updates.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
