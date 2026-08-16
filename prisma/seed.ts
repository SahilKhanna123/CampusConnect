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

  const bayAreaCities = [
    "San Ramon",
    "Fremont",
    "San Jose",
    "Oakland",
    "San Francisco",
    "Palo Alto",
  ];
  for (const name of bayAreaCities) {
    await prisma.city.upsert({
      where: { name_regionId: { name, regionId: bayArea.id } },
      update: {},
      create: { name, regionId: bayArea.id },
    });
  }

  await prisma.city.upsert({
    where: { name_regionId: { name: "Irvine", regionId: uciArea.id } },
    update: {},
    create: { name: "Irvine", regionId: uciArea.id },
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
