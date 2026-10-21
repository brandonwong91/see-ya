import {
  getEvent,
  resolveClaimRequest,
  saveEvent,
  toManageEvent,
} from "@/lib/events";
import { sendClaimResolved } from "@/lib/email";
import { resolveClaimSchema } from "@/lib/validation";
import { fail, handleError, ok, parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Organiser approves or declines a name request. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const event = await getEvent(id);
    if (!event) return fail("Event not found", 404);

    const token = new URL(req.url).searchParams.get("token");
    if (!token || token !== event.editToken) {
      return fail("Not authorised to manage this event", 403);
    }

    const parsed = await parseBody(req, resolveClaimSchema);
    if (!parsed.ok) return parsed.response;

    const { request, invitee, alsoDeclined } = resolveClaimRequest(
      event,
      parsed.data.requestId,
      parsed.data.approve,
    );
    await saveEvent(event);

    await Promise.allSettled([
      sendClaimResolved(event, request, invitee),
      ...alsoDeclined.map((r) => sendClaimResolved(event, r, null)),
    ]);

    return ok({ event: toManageEvent(event) });
  } catch (err) {
    return handleError(err);
  }
}
