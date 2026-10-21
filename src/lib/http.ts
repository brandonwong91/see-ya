import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { PantryError } from "./pantry";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function parseBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<
  { ok: true; data: z.output<S> } | { ok: false; response: NextResponse }
> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { ok: false, response: fail("Request body must be valid JSON") };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: firstIssue(parsed.error), issues: parsed.error.flatten() },
        { status: 422 },
      ),
    };
  }
  return { ok: true, data: parsed.data as z.output<S> };
}

function firstIssue(err: ZodError): string {
  const i = err.issues[0];
  if (!i) return "Invalid input";
  const path = i.path.join(".");
  return path ? `${path}: ${i.message}` : i.message;
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof PantryError) {
    return NextResponse.json(
      { error: err.message },
      {
        status: err.status,
        headers: err.retryAfter
          ? { "Retry-After": String(err.retryAfter) }
          : undefined,
      },
    );
  }
  if (err instanceof ZodError) {
    return fail(firstIssue(err), 422);
  }
  console.error("Unhandled route error:", err);
  return fail("Something went wrong on our side", 500);
}
