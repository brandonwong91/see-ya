import {
  finalize,
  getEvent,
  notifyRecipients,
  reopenEvent,
  saveEvent,
  toManageEvent,
} from "@/lib/events";
import { sendEventFinalized } from "@/lib/email";
import { finalizeSchema } from "@/lib/validation";
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
      return fail("Not authorised to finalise this event", 403);
    }

    const body = await req.json().catch(() => ({}));

    // { reopen: true } clears the finalised date.
    if (body?.reopen === true) {
      const updated = reopenEvent(event);
      await saveEvent(updated);
      return ok({ event: toManageEvent(updated), notified: 0 });
    }

    const parsed = finalizeSchema.safeParse(body);
    if (!parsed.success) return fail("Pick a date to finalise", 422);

    const { event: updated, dateOption } = finalize(event, parsed.data.dateId);
    await saveEvent(updated);

    let notified = 0;
    const recipients = [
      ...notifyRecipients(updated),
      {
        name: updated.organiser.name,
        email: updated.organiser.email,
      },
    ];
    await Promise.allSettled(
      recipients.map(async (r) => {
        await sendEventFinalized(updated, r, dateOption);
        if ("lastNotifiedVersion" in r) r.lastNotifiedVersion = updated.version;
        notified += 1;
      }),
    );
    await saveEvent(updated);

    return ok({ event: toManageEvent(updated), notified });
  } catch (err) {
    return handleError(err);
  }
}
