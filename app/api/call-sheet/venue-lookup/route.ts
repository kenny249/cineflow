import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function nominatimSearch(query: string): Promise<{ lat: string; lon: string; address: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
      { headers: { "User-Agent": "Cineflow/1.0 (contact@usecineflow.com)", "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (!data?.length) return null;

    const { lat, lon, display_name, address: addr } = data[0];
    const parts = [
      addr.house_number, addr.road,
      addr.city || addr.town || addr.village || addr.municipality,
      addr.state, addr.postcode,
    ].filter(Boolean);
    return {
      lat,
      lon,
      address: parts.length >= 3 ? parts.join(", ") : display_name,
    };
  } catch {
    return null;
  }
}

async function overpassHospital(lat: number, lon: number): Promise<string | null> {
  try {
    const query = `[out:json][timeout:15];(node["amenity"="hospital"](around:20000,${lat},${lon});way["amenity"="hospital"](around:20000,${lat},${lon}););out center 10;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
    });
    const data = await res.json();
    if (!data.elements?.length) return null;

    let best: { name: string; dist: number } | null = null;
    for (const el of data.elements) {
      const name = el.tags?.name;
      if (!name) continue;
      const eLat = el.lat ?? el.center?.lat;
      const eLon = el.lon ?? el.center?.lon;
      if (eLat == null || eLon == null) continue;
      const dist = Math.hypot(eLat - lat, eLon - lon);
      if (!best || dist < best.dist) best = { name, dist };
    }
    if (!best) return null;

    // Try to get hospital's street address
    const hNom = await nominatimSearch(best.name);
    if (hNom) {
      return `${best.name} — ${hNom.address}`;
    }
    return best.name;
  } catch {
    return null;
  }
}

async function claudeVenueLookup(venueName: string): Promise<{ address: string | null; lat: number | null; lon: number | null }> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [{
        role: "user",
        content: `What is the full street address of the venue or location named "${venueName}"? Reply with ONLY the address in this exact format: "123 Main St, City, State ZIP" — nothing else. If you are not confident in the address, reply with exactly: UNKNOWN`,
      }],
    });
    const text = (msg.content[0] as any).text?.trim() ?? "";
    if (!text || text === "UNKNOWN" || text.length < 8) return { address: null, lat: null, lon: null };

    // Geocode the Claude-returned address to get coordinates
    const geo = await nominatimSearch(text);
    return {
      address: text,
      lat: geo ? parseFloat(geo.lat) : null,
      lon: geo ? parseFloat(geo.lon) : null,
    };
  } catch {
    return { address: null, lat: null, lon: null };
  }
}

export async function POST(req: NextRequest) {
  const { venueName, city } = await req.json();
  if (!venueName?.trim()) return NextResponse.json({ error: "No venue name" }, { status: 400 });

  try {
    // 1. Try Nominatim first (fast, free)
    const searchQuery = city ? `${venueName}, ${city}` : venueName;
    let geo = await nominatimSearch(searchQuery);

    // 2. If Nominatim fails, fall back to Claude (knows specific venues like "Academy LA")
    let address: string | null = geo?.address ?? null;
    let lat: number | null = geo ? parseFloat(geo.lat) : null;
    let lon: number | null = geo ? parseFloat(geo.lon) : null;

    if (!geo) {
      const claudeResult = await claudeVenueLookup(searchQuery);
      address = claudeResult.address;
      lat = claudeResult.lat;
      lon = claudeResult.lon;
    }

    if (!address) {
      return NextResponse.json({ address: null, lat: null, lng: null, nearestHospital: null });
    }

    // 3. Find nearest hospital if we have coordinates
    let nearestHospital: string | null = null;
    if (lat !== null && lon !== null) {
      nearestHospital = await overpassHospital(lat, lon);
    }

    return NextResponse.json({ address, lat, lng: lon, nearestHospital });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Lookup failed" }, { status: 500 });
  }
}
