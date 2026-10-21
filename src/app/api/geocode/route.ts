import { fail, handleError, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Forward geocoding via OpenStreetMap Nominatim. Proxied server-side so we can
 * set a proper User-Agent (their usage policy requires one) and keep the
 * client free of CORS hassle. Low volume only — do not hammer this.
 */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get("q")?.trim();
    if (!q || q.length < 3) return ok({ results: [] });

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "6");

    const res = await fetch(url, {
      headers: {
        "User-Agent": `seeya/0.1 (${process.env.NEXT_PUBLIC_BASE_URL || "localhost"})`,
        "Accept-Language": "en",
      },
      // Cache identical lookups for a day at the edge.
      next: { revalidate: 86400 },
    });
    if (!res.ok) return fail("Location search is unavailable right now", 502);

    const raw = (await res.json()) as NominatimResult[];
    const results = raw.map((r) => ({
      name: shortName(r),
      address: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
    return ok({ results });
  } catch (err) {
    return handleError(err);
  }
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  type?: string;
  address?: Record<string, string>;
}

function shortName(r: NominatimResult): string {
  if (r.name) return r.name;
  const a = r.address ?? {};
  return (
    a.amenity ||
    a.building ||
    a.road ||
    a.neighbourhood ||
    a.suburb ||
    a.city ||
    a.town ||
    a.village ||
    r.display_name.split(",")[0]
  );
}
