import { Resend } from "resend";
import type { DateOption, EventRecord, Invitee } from "./types";
import { buildIcs } from "./ics";
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
  `;
  const text = `${event.title}\n\nYour event is live. Keep this email as your tracking copy.\n\nManage (private): ${manage}\nShare with invitees: ${share}\n\nReference: ${event.id}`;
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
  `;
  const text = `You're invited: ${event.title}\n\n${event.organiser.name} invited you to help pick a date.\n${message ? `\n"${message}"\n` : ""}\nRespond here: ${link}`;
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
  `;
  const text = `Thanks, ${invitee.name}.\n\nYour availability for "${event.title}" is recorded.\n${chosen.length ? `\nYou're free:\n${chosen.map((d) => "- " + formatDateLong(d.date)).join("\n")}\n` : ""}\nUpdate anytime: ${link}`;
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
  `;
  const text = `Update: ${event.title}\n\n${event.organiser.name} changed:\n${changes.map((c) => "- " + c).join("\n")}\n\nReview: ${link}`;
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
  `;
  const text = `Confirmed: ${event.title}\n\nDate: ${formatDateLong(finalDate.date)}\n${event.time ? `Time: ${formatTime(event.time)}\n` : ""}${event.venue ? `Venue: ${event.venue.name}, ${event.venue.address}\n` : ""}\n${link}`;
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
