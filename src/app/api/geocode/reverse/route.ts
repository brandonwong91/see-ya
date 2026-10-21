import { fail, handleError, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reverse geocoding (lat/lng -> address) via Nominatim, for map-click picks. */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return fail("lat and lng are required", 422);
    }

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url, {
      headers: {
        "User-Agent": `seeya/0.1 (${process.env.NEXT_PUBLIC_BASE_URL || "localhost"})`,
        "Accept-Language": "en",
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return fail("Location lookup is unavailable right now", 502);

    const r = (await res.json()) as {
      display_name?: string;
      name?: string;
      address?: Record<string, string>;
    };
    const a = r.address ?? {};
    const name =
      r.name ||
      a.amenity ||
      a.building ||
      a.road ||
      a.neighbourhood ||
      a.suburb ||
      a.city ||
      "Dropped pin";
    return ok({
      result: {
        name,
        address: r.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
