import { addInvitees, getEvent, saveEvent, toManageEvent } from "@/lib/events";
import { sendInvitation } from "@/lib/email";
import { inviteSchema } from "@/lib/validation";
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

    const token = new URL(req.url).searchParams.get("token");
    if (!token || token !== event.editToken) {
      return fail("Not authorised to invite people to this event", 403);
    }

    const parsed = await parseBody(req, inviteSchema);
    if (!parsed.ok) return parsed.response;

    const { event: updated, invitees } = addInvitees(event, parsed.data);
    await saveEvent(updated);

    let sent = 0;
    await Promise.allSettled(
      invitees.filter((i) => i.email).map(async (invitee) => {
        await sendInvitation(updated, invitee, parsed.data.message);
        invitee.lastNotifiedVersion = updated.version;
        sent += 1;
      }),
    );
    await saveEvent(updated);

    return ok({ event: toManageEvent(updated), added: invitees.length, sent });
  } catch (err) {
    return handleError(err);
  }
}
