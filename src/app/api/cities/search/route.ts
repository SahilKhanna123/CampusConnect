import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Backs CityAutocomplete everywhere a picker needs to resolve typed text to
// a real City row. No auth gate -- matches getCitiesByRegion()'s and
// Explore's own public-data precedent (city names aren't sensitive). No
// rate limiter -- a cheap indexed-scale read against a few hundred rows,
// and the client already debounces per keystroke burst.
const RESULT_LIMIT = 8;
const MIN_QUERY_LENGTH = 2;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ cities: [] });
  }

  const cities = await prisma.city.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    include: { region: true },
    orderBy: { name: "asc" },
    take: RESULT_LIMIT,
  });

  return NextResponse.json({
    cities: cities.map((c) => ({ id: c.id, name: c.name, regionName: c.region.name })),
  });
}
