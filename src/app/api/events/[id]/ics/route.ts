import { getEvent } from "@/lib/events";
import { buildIcs } from "@/lib/ics";
import { fail, handleError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Downloadable calendar file for a finalised event. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const event = await getEvent(id);
    if (!event) return fail("Event not found", 404);

    const finalId = event.finalizedDateId;
    const finalDate = event.dateOptions.find((d) => d.id === finalId);
    if (!finalDate) {
      return fail("This event doesn't have a confirmed date yet", 409);
    }

    const ics = buildIcs(event, finalDate.date);
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${event.id}.ics"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
