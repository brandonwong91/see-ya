# See Ya!

A small, **stateful event-calendar tool for organisers**. Propose a few dates,
drop a pin on the venue with an open-source map, and let invitees choose the
dates that work — or suggest their own. Everyone gets an emailed copy of the
event, and updated invites go out automatically whenever the date, time or
venue changes.

- **No accounts.** Each event is tracked by a unique reference. The organiser
  holds a private link with an edit token; invitees use a public link.
- **State** lives in [Pantry](https://getpantry.cloud) — one JSON basket per
  event (`event-<id>`).
- **Email** goes through [Resend](https://resend.com).
- **Maps** use [Leaflet](https://leafletjs.com) + OpenStreetMap tiles and
  [Nominatim](https://nominatim.org) geocoding. No Google, no API key.

---

## Quick start

```bash
npm install
cp env.example .env.local     # then fill in the values (see below)
npm run dev                   # http://localhost:3000
```

Without a `PANTRY_ID` the app falls back to a local `.pantry-dev/` JSON folder,
and without a `RESEND_API_KEY` it prints emails to the server console instead of
sending them — so `npm run dev` works out of the box for a look around.

## Environment variables

| Variable               | Required | Purpose                                                                                                   |
| ---------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `PANTRY_ID`            | prod     | Your Pantry UUID from getpantry.cloud. The only credential Pantry uses. Unset → local `.pantry-dev/` store. |
| `PANTRY_ENCRYPTION_KEY` | prod     | Server-only, base64-encoded 32-byte key. Encrypts full plans before upload to Pantry. Keep the same key across deployments. |
| `RESEND_API_KEY`       | prod     | Resend API key. Unset → emails are logged, not sent.                                                     |
| `EMAIL_FROM`           | prod     | Sender, e.g. `See Ya! <events@yourdomain.com>`. See the note below.                                   |
| `NEXT_PUBLIC_BASE_URL` | prod     | Public origin for links inside emails, no trailing slash.                                                |
| `EMAIL_DRY_RUN`        | no       | `1` to force console logging even when a Resend key is present.                                          |

### Encrypted storage

Before using remote Pantry, generate `PANTRY_ENCRYPTION_KEY` once and save it
in your server environment:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

The server encrypts each complete plan with AES-256-GCM, a fresh random nonce,
and authentication tied to the basket name. Pantry receives an envelope with
encrypted data, not readable names, emails, notes, venue details, or edit
tokens. Basket names and Pantry's own metadata remain visible. Reads decrypt
on the server before producing the existing public or organiser views.

Keep the key backed up outside Pantry and reuse it on every server instance.
Do not use a `NEXT_PUBLIC_` variable for it. Losing or replacing the key makes
existing encrypted plans unreadable; restoring the original key restores
access. Remote writes fail if the key is missing or malformed.

Existing plaintext plans remain readable and become encrypted on their next
successful save. Enabling encryption does **not** rewrite all existing baskets.
The local development store also encrypts when a key is set; without one it
continues to use plaintext files.

This protects storage in Pantry. Resend still receives email addresses and
message contents to deliver invitations, and the app still displays the data
allowed by each public, guest, or organiser link. It is not end-to-end email
encryption.

### About the Resend sender

To email **arbitrary invitees** you must verify a sending domain in Resend and
set `EMAIL_FROM` to an address on it. Until then, Resend only delivers to the
address that owns the Resend account (its test mode). Everything else works —
the emails just won't reach outside recipients.

## How it works

Creation is a mobile-first, five-step flow: Plan, Dates, Place, People, and
Review. Optional choices advance immediately; multi-date and guest entry wait
for Continue. Review includes edit shortcuts that return straight to the
summary. Nothing is sent until Create plan is pressed.

Motion uses short CSS transitions for step direction, progress, selections,
and confirmation. Timing follows [Emil Kowalski's easing guidance](https://animations.dev/learn/animation-theory/the-easing-blueprint),
with [reduced-motion alternatives](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
The venue map loads only when requested.

| Page                          | Who      | What                                                                                                    |
| ----------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `/`                           | anyone   | Landing page with reference lookup. Opens the public plan; organiser access still requires the private management link. |
| `/create`                     | organiser| Title, description, organiser name/email, candidate dates, optional time, venue (map). Creates the event, emails the organiser their two links. |
| `/event/{id}`                 | invitees | Event details + venue map. Enter name & email, tick available dates or propose new ones, add a note. Gets a tracking-copy email. |
| `/event/{id}/manage?token=…`  | organiser| Availability grid, best-date hint, edit details, invite people, finalise a date, activity log.         |

### Stateful updates

- Editing **date / time / venue** bumps the event version, appends a change-log
  entry, and re-sends an invitation (with the diff spelled out) to everyone who
  has responded or been invited.
- **Finalising** a date closes responses and emails every participant plus the
  organiser a confirmation with an `.ics` calendar attachment.
- Invitees can revisit their own `?e=<inviteeId>` link to change their answer.
  The browser also remembers who you are on each plan (localStorage), and the
  `?e=` is tidied out of the address bar so it isn't pasted into group chats.

### Guest list and claiming names

- The organiser can list guests by **name only**; emails are optional. Guests
  with an email get an invitation; everyone else claims their name from the
  share link.
- On the share link, tapping an unclaimed name claims it. The browser keeps the
  claim, so returning visitors land on their own answers.
- Tapping a name that has an email sends that address its personal link
  instead (at most once per 10 minutes), so nobody can take over an emailed
  guest from the share link.
- Tapping a name that's already claimed lets the visitor **request** it. An email
  is required: they get an acknowledgement, the organiser gets an email and an
  Approve / Decline card on the dashboard, and the requester hears the outcome.
  Approving gives the invitee a new id (signing out the earlier claimer) and
  emails the requester their personal link.
- The public roster uses opaque seat ids derived from the edit token, never the
  invitee ids themselves.

### Messages

- Once a guest has claimed a name (or opened their personal link, or sent in
  their dates), they can leave a message under the plan, choosing **Everyone**
  or **Only the organiser**.
- Public messages show on the share link and are emailed to the organiser and
  every guest with an email, except the author. Private messages are emailed to
  the organiser only, with reply-to set to the guest's email when there is one.
- The dashboard's **Messages** tab lists every message, private ones included,
  and lets the organiser post to everyone.
- Each author can post once every 15 seconds, up to 500 messages per plan.

### Calendar and link previews

- The public page ends with **Add to calendar** (Google Calendar or `.ics`). Before
  a date is locked in, it offers a tentative hold for any proposed date; holds
  share a UID with the confirmed entry, so the confirmation updates them.
- Invitation, response, update, confirmation and approval emails carry the
  same calendar links.
- Share links have a summary in their description / Open Graph / Twitter tags
  (host, leading dates, time, venue, reply count) and a generated preview image.

## API

All under `/api`, JSON in/out. Mutating organiser routes require
`?token=<editToken>`.

| Method & path                       | Purpose                            |
| ----------------------------------- | ---------------------------------- |
| `POST /api/events`                  | Create an event.                   |
| `GET /api/events/{id}`              | Public projection, or full (`?token=`), or one invitee (`?e=`). |
| `PATCH /api/events/{id}`            | Edit; re-invites on material change.|
| `POST /api/events/{id}/rsvp`        | Submit / update availability.      |
| `POST /api/events/{id}/invite`     | Add invitees and email them.       |
| `POST /api/events/{id}/finalize`   | Lock a date (`{dateId}`) or re-open (`{reopen:true}`). |
| `GET /api/events/{id}/ics`          | Calendar file for the confirmed date, or `?date=<optionId>` for a tentative hold.|
| `POST /api/events/{id}/claim`       | Claim a listed name (`{seatId}`), or email its personal link. |
| `POST /api/events/{id}/claim-requests` | Ask the organiser for a claimed name (email required). |
| `POST /api/events/{id}/claim-requests/resolve` | Organiser approves / declines (`{requestId, approve}`). |
| `GET /api/events/{id}/comments`     | Public messages, plus your own private ones with `?e=`. |
| `POST /api/events/{id}/comments`    | Post (`{inviteeId, body, visibility}`), or `?token=` to post as the organiser. |
| `GET /api/geocode?q=` / `…/reverse` | Nominatim proxy (server-side UA).  |

## Deploy (Vercel)

```bash
npm i -g vercel
vercel            # link the project
vercel env add PANTRY_ID
vercel env add PANTRY_ENCRYPTION_KEY   # use the same backed-up key as existing data
vercel env add RESEND_API_KEY
vercel env add EMAIL_FROM
vercel env add NEXT_PUBLIC_BASE_URL     # your production URL
vercel --prod
```

## Notes & limitations

- **Concurrency**: writes are read-modify-write against Pantry, which has no
  compare-and-set. Two RSVPs landing in the same ~200 ms can race; fine at the
  scale this is built for, not for high traffic.
- **Pantry rate limits**: each server process spaces upstream requests at least
  1.1 seconds apart, retries temporary failures with backoff, and respects
  `Retry-After`. Long cooldowns return a temporary-unavailable response with a
  retry time. Multiple server instances still share the upstream quota.
- **Pantry expiry**: baskets are wiped after 30 days of inactivity.
- **Nominatim**: bound by the [OSM usage policy](https://operations.osmfoundation.org/policies/nominatim/)
  — low volume only. Swap in a hosted geocoder for anything busier.
- `npm audit` flags a build-time-only `postcss` advisory inside Next's bundled
  toolchain; it doesn't affect the running app. Resolves when you bump Next.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Zod ·
Leaflet / react-leaflet · Resend · Pantry
