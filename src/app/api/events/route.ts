import { createEvent } from "@/lib/events";
import { sendInvitation, sendOrganiserConfirmation } from "@/lib/email";
import { createEventSchema } from "@/lib/validation";
import { handleError, ok, parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const parsed = await parseBody(req, createEventSchema);
    if (!parsed.ok) return parsed.response;

    const event = await createEvent(parsed.data);

    // Fire the confirmation + invitation emails but don't block the response on them.
    sendOrganiserConfirmation(event).catch((e) =>
      console.error("organiser confirmation failed:", e),
    );
    for (const invitee of event.invitees) {
      sendInvitation(event, invitee, parsed.data.inviteMessage).catch((e) =>
        console.error("invitation failed:", e),
      );
    }

    return ok(
      {
        id: event.id,
        editToken: event.editToken,
        manageUrl: `/event/${event.id}/manage?token=${event.editToken}`,
        shareUrl: `/event/${event.id}`,
        invited: event.invitees.length,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}
