import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { venueName, city } = await req.json();
  if (!venueName?.trim()) return NextResponse.json({ error: "No venue name" }, { status: 400 });

  const query = encodeURIComponent(city ? `${venueName}, ${city}` : venueName);

  try {
    // 1. Geocode via Nominatim (OpenStreetMap, free, no API key)
    const nominatimRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Cineflow/1.0 (contact@usecineflow.com)",
          "Accept-Language": "en",
        },
      }
    );
    const nominatimData = await nominatimRes.json();

    if (!nominatimData?.length) {
      return NextResponse.json({ address: null, lat: null, lng: null, nearestHospital: null });
    }

    const { lat, lon, display_name, address: addr } = nominatimData[0];

    const parts = [
      addr.house_number,
      addr.road,
      addr.city || addr.town || addr.village || addr.municipality,
      addr.state,
      addr.postcode,
    ].filter(Boolean);
    const formattedAddress = parts.length >= 3 ? parts.join(", ") : display_name;

    // 2. Find nearest hospital via Overpass API
    const overpassQuery = `
[out:json][timeout:15];
(
  node["amenity"="hospital"](around:20000,${lat},${lon});
  way["amenity"="hospital"](around:20000,${lat},${lon});
  relation["amenity"="hospital"](around:20000,${lat},${lon});
);
out center 10;
    `.trim();

    const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: overpassQuery,
    });
    const overpassData = await overpassRes.json();

    let nearestHospital: string | null = null;

    if (overpassData.elements?.length) {
      const vLat = parseFloat(lat);
      const vLon = parseFloat(lon);

      // Pick closest hospital with a name
      let best: { name: string; dist: number } | null = null;
      for (const el of overpassData.elements) {
        const name = el.tags?.name;
        if (!name) continue;
        const eLat = el.lat ?? el.center?.lat;
        const eLon = el.lon ?? el.center?.lon;
        if (eLat == null || eLon == null) continue;
        const dist = Math.hypot(eLat - vLat, eLon - vLon);
        if (!best || dist < best.dist) best = { name, dist };
      }

      if (best) {
        nearestHospital = best.name;
        // Try to get address for the hospital
        const hNom = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(best.name)}&format=json&limit=1&addressdetails=1`,
          { headers: { "User-Agent": "Cineflow/1.0 (contact@usecineflow.com)" } }
        );
        const hData = await hNom.json();
        if (hData?.[0]?.address) {
          const ha = hData[0].address;
          const hParts = [
            ha.house_number,
            ha.road,
            ha.city || ha.town || ha.village,
            ha.state,
          ].filter(Boolean);
          if (hParts.length >= 2) nearestHospital = `${best.name} — ${hParts.join(", ")}`;
        }
      }
    }

    return NextResponse.json({
      address: formattedAddress,
      lat: parseFloat(lat),
      lng: parseFloat(lon),
      nearestHospital,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Lookup failed" }, { status: 500 });
  }
}
