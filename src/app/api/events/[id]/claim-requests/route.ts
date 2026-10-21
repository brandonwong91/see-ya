import { addClaimRequest, findSeat, getEvent, saveEvent } from "@/lib/events";
import {
  sendClaimRequestReceived,
  sendClaimRequestToOrganiser,
} from "@/lib/email";
import { claimRequestSchema } from "@/lib/validation";
import { fail, handleError, ok, parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ask the organiser for a name someone else already claimed. The email is
 *  required so we can acknowledge the request and report the decision. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const event = await getEvent(id);
    if (!event) return fail("Event not found", 404);

    const parsed = await parseBody(req, claimRequestSchema);
    if (!parsed.ok) return parsed.response;

    const invitee = findSeat(event, parsed.data.seatId);
    if (!invitee) return fail("That name is no longer on the list", 404);

    const request = addClaimRequest(event, invitee, parsed.data);
    await saveEvent(event);

    await Promise.allSettled([
      sendClaimRequestToOrganiser(event, request),
      sendClaimRequestReceived(event, request),
    ]);

    return ok({ requested: true }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
