import { z } from "zod";

const name = z.string().trim().min(1, "Name is required").max(120);
const email = z.string().trim().toLowerCase().email("Enter a valid email").max(200);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm");

/** Email that may be left blank; normalises to "" when absent. */
const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.union([z.literal(""), z.string().email("Enter a valid email").max(200)]))
  .default("");

export const personSchema = z.object({ name, email });

/** A guest on the invite list: a name is enough, email is optional. */
export const guestSchema = z.object({ name, email: optionalEmail });

export const venueSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(400).default(""),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const createEventSchema = z.object({
  title: z.string().trim().min(1, "Give your event a title").max(160),
  description: z.string().trim().max(4000).default(""),
  organiser: personSchema,
  time: hhmm.nullable().optional().default(null),
  timezone: z.string().trim().max(80).nullable().optional().default(null),
  venue: venueSchema.nullable().optional().default(null),
  dates: z
    .array(isoDate)
    .min(1, "Propose at least one date")
    .max(20, "That's a lot of dates — keep it under 20"),
  /** Optional invitees to email as soon as the event is created. */
  invitees: z.array(guestSchema).max(200).optional().default([]),
  inviteMessage: z.string().trim().max(2000).optional().default(""),
});

export const patchEventSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(4000).optional(),
    time: hhmm.nullable().optional(),
    timezone: z.string().trim().max(80).nullable().optional(),
    venue: venueSchema.nullable().optional(),
    /** Full desired set of organiser-proposed dates (ISO). Invitee-added dates
     * are preserved automatically. */
    dates: z.array(isoDate).max(40).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const rsvpSchema = z.object({
  /** Present when responding as a claimed name or via a personal link. */
  inviteeId: z.string().min(1).max(40).optional(),
  name,
  email: optionalEmail,
  availableDateIds: z.array(z.string().min(1)).default([]),
  /** New dates this invitee wants to propose (ISO). */
  proposeDates: z.array(isoDate).max(10).default([]),
  note: z.string().trim().max(1000).default(""),
});

export const inviteSchema = z.object({
  people: z
    .array(guestSchema)
    .min(1, "Add at least one person")
    .max(200, "Send in smaller batches (max 200)"),
  message: z.string().trim().max(2000).default(""),
});

export const claimSchema = z.object({
  seatId: z.string().min(1).max(40),
});

export const claimRequestSchema = z.object({
  seatId: z.string().min(1).max(40),
  name,
  email,
  message: z.string().trim().max(1000).default(""),
});

export const resolveClaimSchema = z.object({
  requestId: z.string().min(1).max(40),
  approve: z.boolean(),
});

export const commentSchema = z.object({
  /** The guest posting; omitted when the organiser posts with their token. */
  inviteeId: z.string().min(1).max(40).optional(),
  body: z.string().trim().min(1, "Write a message first").max(2000),
  visibility: z.enum(["public", "organiser"]).default("public"),
});

export const finalizeSchema = z.object({
  dateId: z.string().min(1),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type PatchEventInput = z.infer<typeof patchEventSchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type ClaimRequestInput = z.infer<typeof claimRequestSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type FinalizeInput = z.infer<typeof finalizeSchema>;
