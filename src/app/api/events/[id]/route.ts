import {
  applyPatch,
  deleteEvent,
  getEvent,
  notifyRecipients,
  saveEvent,
  toManageEvent,
  toPublicEvent,
} from "@/lib/events";
import {
  sendEventCancelled,
  sendEventDeletedToOrganiser,
  sendEventUpdated,
} from "@/lib/email";
import { patchEventSchema } from "@/lib/validation";
import { fail, handleError, ok, parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const event = await getEvent(id);
    if (!event) return fail("Event not found", 404);

    const sp = new URL(req.url).searchParams;
    const token = sp.get("token");
    if (token && token === event.editToken) {
      return ok({ view: "manage", event: toManageEvent(event) });
    }

    // `?e=<inviteeId>` acts as a capability token for that one person's own
    // response — lets a returning guest prefill their answers.
    const inviteeId = sp.get("e");
    const you = inviteeId
      ? event.invitees.find((i) => i.id === inviteeId)
      : undefined;

    return ok({
      view: "public",
      event: toPublicEvent(event),
      you: you
        ? {
            id: you.id,
            name: you.name,
            email: you.email,
            availableDateIds: you.availableDateIds,
            note: you.note,
          }
        : null,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const event = await getEvent(id);
    if (!event) return fail("Event not found", 404);

    const token = new URL(req.url).searchParams.get("token");
    if (!token || token !== event.editToken) {
      return fail("Not authorised to edit this event", 403);
    }

    const parsed = await parseBody(req, patchEventSchema);
    if (!parsed.ok) return parsed.response;

    const { event: updated, changes, material } = applyPatch(
      event,
      parsed.data,
    );

    if (!changes.length) {
      return ok({ event: toManageEvent(updated), changes: [], notified: 0 });
    }

    await saveEvent(updated);

    let notified = 0;
    if (material) {
      const recipients = notifyRecipients(updated);
      await Promise.allSettled(
        recipients.map(async (r) => {
          await sendEventUpdated(updated, r, changes);
          r.lastNotifiedVersion = updated.version;
          notified += 1;
        }),
      );
      // Persist the bumped lastNotifiedVersion flags.
      await saveEvent(updated);
    }

    return ok({ event: toManageEvent(updated), changes, notified });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const event = await getEvent(id);
    if (!event) return fail("Event not found", 404);

    const token = new URL(req.url).searchParams.get("token");
    if (!token || token !== event.editToken) {
      return fail("Not authorised to delete this event", 403);
    }

    // { notifyGuests: false } skips the cancellation emails; default is on.
    const body = await req.json().catch(() => ({}));
    const notifyGuests = body?.notifyGuests !== false;

    // Delete first, so a failed delete never sends a "deleted" email.
    await deleteEvent(event.id);

    let notified = 0;
    if (notifyGuests) {
      await Promise.allSettled(
        notifyRecipients(event).map(async (r) => {
          await sendEventCancelled(event, r);
          notified += 1;
        }),
      );
    }
    await sendEventDeletedToOrganiser(event, notified).catch((err) =>
      console.error("Deletion confirmation email failed:", err),
    );

    return ok({ deleted: true, notified });
  } catch (err) {
    return handleError(err);
  }
}
