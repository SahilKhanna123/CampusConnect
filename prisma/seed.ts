// Seeds the launch data: the two initial Regions, common Cities within
// them, the featured Bay Area <-> UCI RouteCommunity, and the UCI email
// domain. Cities are NOT meant to stay closed to this list — see the plan
// doc §8: any City (e.g. an airport) can be attached to a Trip/Request,
// this seed just covers what Home should feature by default at launch.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const bayArea = await prisma.region.upsert({
    where: { slug: "bay-area" },
    update: {},
    create: { name: "Bay Area", slug: "bay-area" },
  });

  const uciArea = await prisma.region.upsert({
    where: { slug: "uc-irvine-area" },
    update: {},
    create: { name: "UC Irvine Area", slug: "uc-irvine-area" },
  });

  // City-center coordinates -- populated so the Explore route map (see
  // src/lib/geocode.ts) can plot these cities immediately, without a
  // Nominatim round trip on first use.
  const bayAreaCities: { name: string; latitude: number; longitude: number }[] = [
    { name: "San Ramon", latitude: 37.7799, longitude: -121.978 },
    { name: "Fremont", latitude: 37.5485, longitude: -121.9886 },
    { name: "San Jose", latitude: 37.3382, longitude: -121.8863 },
    { name: "Oakland", latitude: 37.8044, longitude: -122.2712 },
    { name: "San Francisco", latitude: 37.7749, longitude: -122.4194 },
    { name: "Palo Alto", latitude: 37.4419, longitude: -122.143 },
  ];
  for (const { name, latitude, longitude } of bayAreaCities) {
    await prisma.city.upsert({
      where: { name_regionId: { name, regionId: bayArea.id } },
      update: { latitude, longitude },
      create: { name, regionId: bayArea.id, latitude, longitude },
    });
  }

  await prisma.city.upsert({
    where: { name_regionId: { name: "Irvine", regionId: uciArea.id } },
    update: { latitude: 33.6846, longitude: -117.8265 },
    create: {
      name: "Irvine",
      regionId: uciArea.id,
      latitude: 33.6846,
      longitude: -117.8265,
    },
  });

  await prisma.routeCommunity.upsert({
    where: {
      regionAId_regionBId: { regionAId: bayArea.id, regionBId: uciArea.id },
    },
    update: { active: true },
    create: { regionAId: bayArea.id, regionBId: uciArea.id, active: true },
  });

  await prisma.supportedUniversityDomain.upsert({
    where: { domain: "uci.edu" },
    update: {},
    create: {
      domain: "uci.edu",
      universityName: "University of California, Irvine",
      regionId: uciArea.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
