import { Resend } from "resend";
import type {
  ClaimRequest,
  Comment,
  DateOption,
  EventRecord,
  Invitee,
} from "./types";
import { buildIcs } from "./ics";
import { googleCalendarUrl, icsPath } from "./calendar";
import { formatDateLong, formatTime } from "./format";

const DRY_RUN =
  process.env.EMAIL_DRY_RUN === "1" || !process.env.RESEND_API_KEY;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function from(): string {
  return process.env.EMAIL_FROM || "See Ya! <onboarding@resend.dev>";
}

export function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function manageUrl(event: EventRecord): string {
  return `${baseUrl()}/event/${event.id}/manage?token=${event.editToken}`;
}

export function publicUrl(event: EventRecord): string {
  return `${baseUrl()}/event/${event.id}`;
}

interface Attachment {
  filename: string;
  content: string; // base64
}

interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
  replyTo?: string;
}

async function send(mail: OutgoingEmail): Promise<void> {
  // Name-only guests have nowhere to send to.
  if (!mail.to) return;
  if (DRY_RUN || !resend) {
    console.log(
      `\n─── EMAIL (dry run) ───────────────────────────\nTo: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n───────────────────────────────────────────────\n`,
    );
    return;
  }
  const { error } = await resend.emails.send({
    from: from(),
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    replyTo: mail.replyTo,
    attachments: mail.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });
  if (error) {
    // Don't fail the whole request because one email bounced — log and move on.
    console.error(`Resend error for ${mail.to}:`, error);
  }
}

// ─── Shared template shell ──────────────────────────────────────────────────

const INK = "#2C2623";
const MUTED = "#5C524D";
const LINE = "#EADFC8";
const PAPER = "#FDF2D9";
const ACCENT = "#F9C6B4";
const GRAPE = "#D6C7F0";
const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function shell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:${PAPER};padding:32px 0;font-family:${SANS};color:${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFF8EA;border:2px solid ${INK};border-radius:20px;overflow:hidden">
    <tr><td style="background:${GRAPE};padding:16px 32px">
      <span style="font-family:${SANS};font-size:16px;font-weight:800;color:${INK};letter-spacing:-0.01em">See Ya<span style="color:${INK}">!</span></span>
    </td></tr>
    <tr><td style="padding:24px 32px 28px">${inner}</td></tr>
    <tr><td style="padding:16px 32px;border-top:2px solid ${LINE};font-family:${SANS};font-size:11px;color:${MUTED}">
      Sent by See Ya! on behalf of the organiser. Keep this email — it's your copy of the plan.
    </td></tr>
  </table>
  </td></tr></table></body></html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${ACCENT};color:${INK};text-decoration:none;font-family:${SANS};font-size:14px;font-weight:700;padding:12px 24px;margin:4px 0;border-radius:999px;border:2px solid ${INK}">${label}</a>`;
}

function h1(text: string): string {
  return `<h1 style="font-family:${SANS};font-size:25px;font-weight:800;line-height:1.15;letter-spacing:-0.02em;margin:6px 0 14px">${escapeHtml(text)}</h1>`;
}

function p(text: string): string {
  return `<p style="font-family:${SANS};font-size:15px;line-height:1.6;margin:0 0 14px;color:${INK}">${text}</p>`;
}

function detailBlock(event: EventRecord, dates: DateOption[]): string {
  const rows: string[] = [];
  if (event.venue) {
    rows.push(
      row(
        "Venue",
        `${escapeHtml(event.venue.name)}${event.venue.address ? `<br><span style="color:${MUTED}">${escapeHtml(event.venue.address)}</span>` : ""}`,
      ),
    );
  }
  if (event.time) {
    rows.push(row("Time", formatTime(event.time) + (event.timezone ? ` (${escapeHtml(event.timezone)})` : "")));
  }
  const dateList = dates
    .map((d) => `<div>${formatDateLong(d.date)}</div>`)
    .join("");
  rows.push(row(dates.length > 1 ? "Date options" : "Date", dateList));

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border:2px solid ${LINE};border-radius:14px;margin:6px 0 20px">${rows.join("")}</table>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:12px 16px;vertical-align:top;width:96px;font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${MUTED}">${label}</td>
    <td style="padding:12px 16px;font-family:${SANS};font-size:15px;line-height:1.5">${value}</td>
  </tr>`;
}

function finalDateOf(event: EventRecord): DateOption | undefined {
  return event.dateOptions.find((d) => d.id === event.finalizedDateId);
}

/**
 * "Add to calendar" block. Once the plan is locked in it's a pair of buttons
 * for the confirmed date; before that, a compact list of tentative holds for
 * `dates` so people can pencil them in.
 */
function calendarBlock(event: EventRecord, dates: DateOption[]): string {
  // The plain share link, never a personal `?e=` one: calendar entries get
  // shared and synced in ways an email doesn't.
  const link = publicUrl(event);
  const final = finalDateOf(event);
  if (final) {
    const google = googleCalendarUrl(event, final.date, { link });
    const ics = baseUrl() + icsPath(event.id);
    return `
      <p style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};margin:22px 0 6px">Add to calendar</p>
      ${btn(escapeHtml(google), "Google Calendar")} ${btn(ics, "Apple / Outlook (.ics)")}`;
  }
  if (!dates.length) return "";
  const rows = dates
    .map((d) => {
      const google = googleCalendarUrl(event, d.date, { tentative: true, link });
      const ics = baseUrl() + icsPath(event.id, d.id);
      return `<tr>
        <td style="padding:6px 0;font-family:${SANS};font-size:14px">${formatDateLong(d.date)}</td>
        <td align="right" style="padding:6px 0;font-family:${SANS};font-size:13px;white-space:nowrap">
          <a href="${escapeHtml(google)}" style="color:${INK};font-weight:700">Google</a>
          <span style="color:${MUTED}">&nbsp;·&nbsp;</span>
          <a href="${ics}" style="color:${INK};font-weight:700">Apple / Outlook</a>
        </td>
      </tr>`;
    })
    .join("");
  return `
    <p style="font-family:${SANS};font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};margin:22px 0 6px">Pencil it in (tentative)</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE}">${rows}</table>`;
}

function calendarText(event: EventRecord, dates: DateOption[]): string {
  const link = publicUrl(event);
  const final = finalDateOf(event);
  if (final) {
    return `\nAdd to calendar:\n- Google: ${googleCalendarUrl(event, final.date, { link })}\n- Apple / Outlook: ${baseUrl() + icsPath(event.id)}\n`;
  }
  if (!dates.length) return "";
  return (
    `\nPencil it in (tentative):\n` +
    dates
      .map(
        (d) =>
          `- ${formatDateLong(d.date)}: ${googleCalendarUrl(event, d.date, { tentative: true, link })} | ${baseUrl() + icsPath(event.id, d.id)}`,
      )
      .join("\n") +
    "\n"
  );
}

export function maskEmail(email: string): string {
  const [user, domain = ""] = email.split("@");
  return `${user.slice(0, 1)}•••@${domain}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function sendOrganiserConfirmation(
  event: EventRecord,
): Promise<void> {
  const manage = manageUrl(event);
  const share = publicUrl(event);
  const inner = `
    ${h1(event.title)}
    ${p(`Your event is live. This email is your <strong>tracking copy</strong> — it holds the two links you need.`)}
    ${detailBlock(event, event.dateOptions)}
    ${p(`<strong>1. Manage link</strong> (keep private — anyone with it can edit):<br>${btn(manage, "Open organiser dashboard")}`)}
    ${p(`<strong>2. Share link</strong> (send to invitees so they can pick dates):<br><a href="${share}" style="color:${INK}">${share}</a>`)}
    ${p(`Event reference: <code style="font-family:ui-monospace,Menlo,monospace">${event.id}</code>`)}
    ${calendarBlock(event, event.dateOptions)}
  `;
  const text = `${event.title}\n\nYour event is live. Keep this email as your tracking copy.\n\nManage (private): ${manage}\nShare with invitees: ${share}\n\nReference: ${event.id}\n${calendarText(event, event.dateOptions)}`;
  await send({
    to: event.organiser.email,
    subject: `Your event is live — ${event.title}`,
    html: shell(inner),
    text,
  });
}

export async function sendInvitation(
  event: EventRecord,
  invitee: Invitee,
  message: string,
): Promise<void> {
  const link = `${publicUrl(event)}?e=${invitee.id}`;
  const inner = `
    ${h1(`You're invited: ${event.title}`)}
    ${p(`${escapeHtml(event.organiser.name)} invited you to help choose a date for <strong>${escapeHtml(event.title)}</strong>.`)}
    ${message ? p(`<em>"${escapeHtml(message)}"</em>`) : ""}
    ${event.description ? p(escapeHtml(event.description)) : ""}
    ${detailBlock(event, event.dateOptions)}
    ${p(`Tap below to mark which dates work for you (or suggest another):`)}
    ${btn(link, "Choose your dates")}
    ${calendarBlock(event, event.dateOptions)}
  `;
  const text = `You're invited: ${event.title}\n\n${event.organiser.name} invited you to help pick a date.\n${message ? `\n"${message}"\n` : ""}\nRespond here: ${link}\n${calendarText(event, event.dateOptions)}`;
  await send({
    to: invitee.email,
    subject: `Invitation: ${event.title}`,
    html: shell(inner),
    text,
    replyTo: event.organiser.email,
  });
}

export async function sendRsvpConfirmation(
  event: EventRecord,
  invitee: Invitee,
): Promise<void> {
  const chosen = event.dateOptions.filter((d) =>
    invitee.availableDateIds.includes(d.id),
  );
  const link = `${publicUrl(event)}?e=${invitee.id}`;
  const inner = `
    ${h1(`Got it — thanks, ${escapeHtml(invitee.name.split(" ")[0] || invitee.name)}`)}
    ${p(`Your availability for <strong>${escapeHtml(event.title)}</strong> has been recorded. This email is your tracking copy.`)}
    ${
      chosen.length
        ? `<table role="presentation" width="100%" style="border-top:1px solid ${LINE};margin:6px 0 18px">${row("You're free", chosen.map((d) => `<div>${formatDateLong(d.date)}</div>`).join(""))}</table>`
        : p(`You didn't mark any of the current dates as workable.`)
    }
    ${invitee.note ? p(`Your note: <em>"${escapeHtml(invitee.note)}"</em>`) : ""}
    ${p(`Need to change your answer? Use the same link:`)}
    ${btn(link, "Update my availability")}
    ${p(`We'll email you if the organiser changes the date, time or venue.`)}
    ${calendarBlock(event, chosen)}
  `;
  const text = `Thanks, ${invitee.name}.\n\nYour availability for "${event.title}" is recorded.\n${chosen.length ? `\nYou're free:\n${chosen.map((d) => "- " + formatDateLong(d.date)).join("\n")}\n` : ""}\nUpdate anytime: ${link}\n${calendarText(event, chosen)}`;
  await send({
    to: invitee.email,
    subject: `Your response to ${event.title}`,
    html: shell(inner),
    text,
    replyTo: event.organiser.email,
  });
}

export async function sendEventUpdated(
  event: EventRecord,
  recipient: Invitee,
  changes: string[],
): Promise<void> {
  const link = `${publicUrl(event)}?e=${recipient.id}`;
  const inner = `
    ${h1(`Update: ${event.title}`)}
    ${p(`${escapeHtml(event.organiser.name)} changed the following:`)}
    <ul style="font-size:15px;line-height:1.7;margin:0 0 16px;padding-left:20px">${changes.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
    ${detailBlock(event, event.dateOptions)}
    ${p(`Please review — your earlier availability may no longer apply:`)}
    ${btn(link, "Review and re-confirm")}
    ${calendarBlock(event, event.dateOptions)}
  `;
  const text = `Update: ${event.title}\n\n${event.organiser.name} changed:\n${changes.map((c) => "- " + c).join("\n")}\n\nReview: ${link}\n${calendarText(event, event.dateOptions)}`;
  await send({
    to: recipient.email,
    subject: `Changed: ${event.title}`,
    html: shell(inner),
    text,
    replyTo: event.organiser.email,
  });
}

export async function sendEventFinalized(
  event: EventRecord,
  recipient: Invitee | { name: string; email: string; id?: string },
  finalDate: DateOption,
): Promise<void> {
  const ics = buildIcs(event, finalDate.date);
  const link = "id" in recipient && recipient.id
    ? `${publicUrl(event)}?e=${recipient.id}`
    : publicUrl(event);
  const inner = `
    ${h1(`Confirmed: ${event.title}`)}
    ${p(`The plan is locked in:`)}
    <table role="presentation" width="100%" style="border-top:1px solid ${LINE};margin:6px 0 18px">
      ${row("Date", `<strong>${formatDateLong(finalDate.date)}</strong>`)}
      ${event.time ? row("Time", formatTime(event.time) + (event.timezone ? ` (${escapeHtml(event.timezone)})` : "")) : ""}
      ${event.venue ? row("Venue", `${escapeHtml(event.venue.name)}<br><span style="color:${MUTED}">${escapeHtml(event.venue.address)}</span>`) : ""}
    </table>
    ${p(`A calendar invite (.ics) is attached. Details are also here:`)}
    ${btn(link, "View event")}
    ${calendarBlock(event, [finalDate])}
  `;
  const text = `Confirmed: ${event.title}\n\nDate: ${formatDateLong(finalDate.date)}\n${event.time ? `Time: ${formatTime(event.time)}\n` : ""}${event.venue ? `Venue: ${event.venue.name}, ${event.venue.address}\n` : ""}\n${link}\n${calendarText(event, [finalDate])}`;
  await send({
    to: recipient.email,
    subject: `Confirmed: ${event.title} — ${formatDateLong(finalDate.date)}`,
    html: shell(inner),
    text,
    replyTo: event.organiser.email,
    attachments: [
      {
        filename: "event.ics",
        content: Buffer.from(ics, "utf-8").toString("base64"),
      },
    ],
  });
}

// ─── Claiming names ─────────────────────────────────────────────────────────

/** Someone tapped a listed name that has an email: send that person their own
 *  link rather than handing the name to whoever is holding the share link. */
export async function sendPersonalLink(
  event: EventRecord,
  invitee: Invitee,
): Promise<void> {
  const link = `${publicUrl(event)}?e=${invitee.id}`;
  const inner = `
    ${h1(`Your link for ${event.title}`)}
    ${p(`Someone opened the share link for <strong>${escapeHtml(event.title)}</strong> and said they're ${escapeHtml(invitee.name)}. If that was you, here's your personal link:`)}
    ${btn(link, "Open my invite")}
    ${p(`<span style="color:${MUTED}">Not you? You can ignore this email — nothing changes until you use the link.</span>`)}
  `;
  const text = `Your link for ${event.title}\n\nSomeone said they're ${invitee.name} on the share link. If that was you: ${link}\n\nNot you? Ignore this email.`;
  await send({
    to: invitee.email,
    subject: `Your link: ${event.title}`,
    html: shell(inner),
    text,
    replyTo: event.organiser.email,
  });
}

export async function sendClaimRequestToOrganiser(
  event: EventRecord,
  request: ClaimRequest,
): Promise<void> {
  const manage = manageUrl(event);
  const inner = `
    ${h1(`Name request: ${event.title}`)}
    ${p(`<strong>${escapeHtml(request.name)}</strong> (${escapeHtml(request.email)}) says they're <strong>${escapeHtml(request.seatName)}</strong> on your guest list, but that name has already been claimed.`)}
    ${request.message ? p(`<em>"${escapeHtml(request.message)}"</em>`) : ""}
    ${p(`Approving gives them the name and its answers, and signs out whoever claimed it before. Either way, they'll get an email.`)}
    ${btn(manage, "Review the request")}
  `;
  const text = `Name request: ${event.title}\n\n${request.name} <${request.email}> says they're "${request.seatName}" on your guest list, but that name is already claimed.\n${request.message ? `\n"${request.message}"\n` : ""}\nReview: ${manage}`;
  await send({
    to: event.organiser.email,
    subject: `${request.name} is asking to be "${request.seatName}" — ${event.title}`,
    html: shell(inner),
    text,
    replyTo: request.email,
  });
}

export async function sendClaimRequestReceived(
  event: EventRecord,
  request: ClaimRequest,
): Promise<void> {
  const inner = `
    ${h1(`Request sent`)}
    ${p(`We've asked ${escapeHtml(event.organiser.name)} to confirm you're <strong>${escapeHtml(request.seatName)}</strong> for <strong>${escapeHtml(event.title)}</strong>.`)}
    ${p(`You'll get another email as soon as they decide — with your personal link if it's approved.`)}
    ${detailBlock(event, event.dateOptions)}
  `;
  const text = `Request sent\n\nWe've asked ${event.organiser.name} to confirm you're "${request.seatName}" for ${event.title}. You'll get another email once they decide.`;
  await send({
    to: request.email,
    subject: `Request sent: ${event.title}`,
    html: shell(inner),
    text,
    replyTo: event.organiser.email,
  });
}

export async function sendClaimResolved(
  event: EventRecord,
  request: ClaimRequest,
  invitee: Invitee | null,
): Promise<void> {
  if (request.status === "approved" && invitee) {
    const link = `${publicUrl(event)}?e=${invitee.id}`;
    const inner = `
      ${h1(`You're ${escapeHtml(request.seatName)} — all set`)}
      ${p(`${escapeHtml(event.organiser.name)} approved your request for <strong>${escapeHtml(event.title)}</strong>. Use your personal link to pick your dates:`)}
      ${btn(link, "Open my invite")}
      ${detailBlock(event, event.dateOptions)}
      ${p(`We'll email you at ${escapeHtml(maskEmail(invitee.email))} if the date, time or venue changes.`)}
      ${calendarBlock(event, event.dateOptions)}
    `;
    const text = `Approved: you're "${request.seatName}" for ${event.title}.\n\nYour personal link: ${link}\n${calendarText(event, event.dateOptions)}`;
    await send({
      to: request.email,
      subject: `Approved: ${event.title}`,
      html: shell(inner),
      text,
      replyTo: event.organiser.email,
    });
    return;
  }
  const share = publicUrl(event);
  const inner = `
    ${h1(`About your request`)}
    ${p(`${escapeHtml(event.organiser.name)} didn't confirm you as <strong>${escapeHtml(request.seatName)}</strong> for <strong>${escapeHtml(event.title)}</strong>. You can still respond under your own name:`)}
    ${btn(share, "Respond as myself")}
    ${p(`<span style="color:${MUTED}">Think it's a mix-up? Reply to this email to reach the organiser.</span>`)}
  `;
  const text = `About your request\n\n${event.organiser.name} didn't confirm you as "${request.seatName}" for ${event.title}. You can still respond under your own name: ${share}\n\nReply to this email to reach the organiser.`;
  await send({
    to: request.email,
    subject: `Update on your request: ${event.title}`,
    html: shell(inner),
    text,
    replyTo: event.organiser.email,
  });
}

// ─── Comments ───────────────────────────────────────────────────────────────

function quote(body: string): string {
  return `<div style="background:${PAPER};border:2px solid ${LINE};border-radius:14px;padding:14px 16px;margin:6px 0 20px;font-family:${SANS};font-size:15px;line-height:1.6;white-space:pre-line">${escapeHtml(body)}</div>`;
}

/** A guest left a message: the organiser gets every one, private or public.
 *  Replying to the email goes straight to the guest when we know their email. */
export async function sendCommentToOrganiser(
  event: EventRecord,
  comment: Comment,
  author: Invitee,
): Promise<void> {
  const manage = manageUrl(event);
  const isPrivate = comment.visibility === "organiser";
  const inner = `
    ${h1(isPrivate ? `Message for you: ${event.title}` : `New message: ${event.title}`)}
    ${p(`<strong>${escapeHtml(comment.authorName)}</strong> ${isPrivate ? "sent you a private message" : "posted to everyone on the plan"}:`)}
    ${quote(comment.body)}
    ${p(author.email ? `Reply to this email to answer ${escapeHtml(comment.authorName)} directly.` : `<span style="color:${MUTED}">${escapeHtml(comment.authorName)} hasn't left an email, so reply from your dashboard.</span>`)}
    ${btn(manage, "Open organiser dashboard")}
  `;
  const text = `${isPrivate ? "Message for you" : "New message"}: ${event.title}\n\n${comment.authorName}${isPrivate ? " (private)" : ""}:\n\n${comment.body}\n\nDashboard: ${manage}`;
  await send({
    to: event.organiser.email,
    subject: isPrivate
      ? `${comment.authorName} messaged you — ${event.title}`
      : `${comment.authorName} posted — ${event.title}`,
    html: shell(inner),
    text,
    replyTo: author.email || undefined,
  });
}

/** A public message, sent to a guest who didn't write it. */
export async function sendCommentToGuest(
  event: EventRecord,
  comment: Comment,
  recipient: Invitee,
): Promise<void> {
  const link = `${publicUrl(event)}?e=${recipient.id}#messages`;
  const who = comment.authorId === null
    ? `${comment.authorName} (organiser)`
    : comment.authorName;
  const inner = `
    ${h1(`New message: ${event.title}`)}
    ${p(`<strong>${escapeHtml(who)}</strong> posted to everyone on the plan:`)}
    ${quote(comment.body)}
    ${btn(link, "Reply on the plan")}
    ${p(`<span style="color:${MUTED}">Replying to this email reaches the organiser only.</span>`)}
  `;
  const text = `New message: ${event.title}\n\n${who}:\n\n${comment.body}\n\nReply on the plan: ${link}\n(Replying to this email reaches the organiser only.)`;
  await send({
    to: recipient.email,
    subject: `${comment.authorName} posted — ${event.title}`,
    html: shell(inner),
    text,
    replyTo: event.organiser.email,
  });
}
