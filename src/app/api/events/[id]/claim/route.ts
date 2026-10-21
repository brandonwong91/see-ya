import { findSeat, getEvent, saveEvent, seatStatus } from "@/lib/events";
import { maskEmail, sendPersonalLink } from "@/lib/email";
import { claimSchema } from "@/lib/validation";
import { fail, handleError, ok, parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Don't let the share link be used to spam a guest's inbox. */
const RESEND_AFTER_MS = 10 * 60 * 1000;

/**
 * A visitor on the share link says "that's me" for a listed name.
 * - Open name (no email): it's theirs; we return the invitee id, which the
 *   browser keeps so they're recognised next time.
 * - Name with an email: we email that address their personal link instead.
 * - Already claimed: 409 with `taken`, so the client can offer a request.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const event = await getEvent(id);
    if (!event) return fail("Event not found", 404);

    const parsed = await parseBody(req, claimSchema);
    if (!parsed.ok) return parsed.response;

    const invitee = findSeat(event, parsed.data.seatId);
    if (!invitee) return fail("That name is no longer on the list", 404);

    const status = seatStatus(invitee);
    if (status === "taken") {
      return ok(
        { error: `${invitee.name} has already been claimed`, taken: true },
        { status: 409 },
      );
    }

    if (status === "emailed") {
      const last = invitee.linkSentAt ? Date.parse(invitee.linkSentAt) : 0;
      if (Date.now() - last > RESEND_AFTER_MS) {
        invitee.linkSentAt = new Date().toISOString();
        await saveEvent(event);
        sendPersonalLink(event, invitee).catch((e) =>
          console.error("personal link failed:", e),
        );
      }
      return ok({ emailed: true, to: maskEmail(invitee.email) });
    }

    invitee.claimedAt = new Date().toISOString();
    await saveEvent(event);
    return ok({
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
