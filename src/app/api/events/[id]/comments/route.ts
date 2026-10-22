import {
  addComment,
  getEvent,
  notifyRecipients,
  saveEvent,
  toManageEvent,
  visibleComments,
} from "@/lib/events";
import { sendCommentToGuest, sendCommentToOrganiser } from "@/lib/email";
import { commentSchema } from "@/lib/validation";
import { fail, handleError, ok, parseBody } from "@/lib/http";
import type { EventRecord, Invitee } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

function guest(event: EventRecord, inviteeId: string | null | undefined) {
  return inviteeId
    ? event.invitees.find((i) => i.id === inviteeId) ?? null
    : null;
}

function youOf(invitee: Invitee | null) {
  return invitee ? { id: invitee.id, name: invitee.name } : null;
}

/** The thread as one guest sees it (`?e=<inviteeId>`), or as anyone with the
 *  share link when there's no `e`. */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const event = await getEvent(id);
    if (!event) return fail("Event not found", 404);

    const you = guest(event, new URL(req.url).searchParams.get("e"));
    return ok({
      you: youOf(you),
      comments: visibleComments(event, you?.id ?? null),
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Leave a message. Guests post as the name they've claimed (their invitee id,
 * from a claim or a personal link) and choose whether everyone or only the
 * organiser sees it. The organiser posts with `?token=`, always to everyone.
 *
 * Each message is emailed on: private ones to the organiser; public ones to the
 * organiser and every guest with an email, except whoever wrote it.
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const event = await getEvent(id);
    if (!event) return fail("Event not found", 404);

    const parsed = await parseBody(req, commentSchema);
    if (!parsed.ok) return parsed.response;

    const token = new URL(req.url).searchParams.get("token");
    const asOrganiser = Boolean(token) && token === event.editToken;
    const author = asOrganiser ? null : guest(event, parsed.data.inviteeId);
    if (!asOrganiser && !author) {
      return fail("Claim your name on the plan before leaving a message", 403);
    }

    const comment = addComment(event, author, parsed.data);
    await saveEvent(event);

    const sends: Promise<void>[] = [];
    if (author) sends.push(sendCommentToOrganiser(event, comment, author));
    if (comment.visibility === "public") {
      for (const r of notifyRecipients(event)) {
        if (r.id !== author?.id) sends.push(sendCommentToGuest(event, comment, r));
      }
    }
    await Promise.allSettled(sends);

    if (asOrganiser) {
      return ok({ event: toManageEvent(event) }, { status: 201 });
    }
    return ok(
      {
        you: youOf(author),
        comments: visibleComments(event, author!.id),
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}
