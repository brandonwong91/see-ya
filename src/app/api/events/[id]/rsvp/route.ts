import { applyRsvp, getEvent, saveEvent, toPublicEvent } from "@/lib/events";
import { sendRsvpConfirmation } from "@/lib/email";
import { rsvpSchema } from "@/lib/validation";
import { fail, handleError, ok, parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const event = await getEvent(id);
    if (!event) return fail("Event not found", 404);
    if (event.finalizedDateId) {
      return fail("This event is already finalised — responses are closed", 409);
    }

    const parsed = await parseBody(req, rsvpSchema);
    if (!parsed.ok) return parsed.response;

    const { event: updated, invitee } = applyRsvp(event, parsed.data);
    await saveEvent(updated);

    sendRsvpConfirmation(updated, invitee).catch((e) =>
      console.error("rsvp confirmation failed:", e),
    );

    return ok({
      event: toPublicEvent(updated),
      you: {
        id: invitee.id,
        name: invitee.name,
        email: invitee.email,
        availableDateIds: invitee.availableDateIds,
        note: invitee.note,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
