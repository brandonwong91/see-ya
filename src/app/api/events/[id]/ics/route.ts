import { getEvent } from "@/lib/events";
import { buildIcs } from "@/lib/ics";
import { fail, handleError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Downloadable calendar file. Serves the confirmed date, or with
 *  `?date=<dateOptionId>` a tentative hold for one of the proposed dates. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const event = await getEvent(id);
    if (!event) return fail("Event not found", 404);

    const requested = new URL(req.url).searchParams.get("date");
    const finalDate = event.dateOptions.find(
      (d) => d.id === event.finalizedDateId,
    );
    // Once a date is locked in, every link serves the confirmed entry.
    const option =
      finalDate ??
      (requested
        ? event.dateOptions.find((d) => d.id === requested)
        : undefined);
    if (!option) {
      return fail(
        requested
          ? "That date is no longer on the plan"
          : "This event doesn't have a confirmed date yet",
        requested ? 404 : 409,
      );
    }

    const ics = buildIcs(event, option.date, { tentative: !finalDate });
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${event.id}-${option.date}.ics"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
