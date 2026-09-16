// Seeds Region/City data. Originally launch-scoped to just Bay Area <-> UC
// Irvine; broadened per direct product decision to a much wider set of real
// US metro areas so posting/browsing isn't limited to one corridor. Cities
// are NOT meant to stay closed to this list -- any City (e.g. an airport)
// can be attached to a Trip/PackagePost; this seed just gives every picker
// (CityAutocomplete, via GET /api/cities/search) a broad real starting set.
// Coordinates are approximate city-center points, good enough for the
// proximity sort on Home (src/lib/distance.ts) and the Explore route map --
// never treated as survey-precise (see the latitude/longitude comment on
// the City model in prisma/schema.prisma).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type RegionSeed = {
  name: string;
  slug: string;
  cities: [name: string, lat: number, lng: number][];
};

const regions: RegionSeed[] = [
  // Original launch regions -- kept exactly as they were.
  {
    name: "Bay Area",
    slug: "bay-area",
    cities: [
      ["San Ramon", 37.7799, -121.978],
      ["Fremont", 37.5485, -121.9886],
      ["San Jose", 37.3382, -121.8863],
      ["Oakland", 37.8044, -122.2712],
      ["San Francisco", 37.7749, -122.4194],
      ["Palo Alto", 37.4419, -122.143],
    ],
  },
  {
    name: "UC Irvine Area",
    slug: "uc-irvine-area",
    cities: [["Irvine", 33.6846, -117.8265]],
  },

  // West Coast
  {
    name: "Los Angeles Metro",
    slug: "los-angeles-metro",
    cities: [
      ["Los Angeles", 34.0522, -118.2437],
      ["Long Beach", 33.7701, -118.1937],
      ["Pasadena", 34.1478, -118.1445],
      ["Santa Monica", 34.0195, -118.4912],
      ["Burbank", 34.1808, -118.309],
      ["Glendale", 34.1425, -118.2551],
    ],
  },
  {
    name: "San Diego Metro",
    slug: "san-diego-metro",
    cities: [
      ["San Diego", 32.7157, -117.1611],
      ["Chula Vista", 32.6401, -117.0842],
      ["Oceanside", 33.1959, -117.3795],
      ["Carlsbad", 33.1581, -117.3506],
      ["Escondido", 33.1192, -117.0864],
    ],
  },
  {
    name: "Sacramento Metro",
    slug: "sacramento-metro",
    cities: [
      ["Sacramento", 38.5816, -121.4944],
      ["Elk Grove", 38.4088, -121.3716],
      ["Roseville", 38.7521, -121.288],
      ["Davis", 38.5449, -121.7405],
      ["Folsom", 38.6779, -121.1761],
    ],
  },
  {
    name: "Seattle Metro",
    slug: "seattle-metro",
    cities: [
      ["Seattle", 47.6062, -122.3321],
      ["Bellevue", 47.6101, -122.2015],
      ["Tacoma", 47.2529, -122.4443],
      ["Everett", 47.979, -122.2021],
      ["Redmond", 47.674, -122.1215],
    ],
  },
  {
    name: "Portland Metro",
    slug: "portland-metro",
    cities: [
      ["Portland", 45.5152, -122.6784],
      ["Beaverton", 45.4871, -122.8037],
      ["Gresham", 45.5001, -122.4302],
      ["Hillsboro", 45.5229, -122.9898],
      ["Vancouver", 45.6387, -122.6615],
    ],
  },
  {
    name: "Las Vegas Metro",
    slug: "las-vegas-metro",
    cities: [
      ["Las Vegas", 36.1699, -115.1398],
      ["Henderson", 36.0395, -114.9817],
      ["North Las Vegas", 36.1989, -115.1175],
      ["Summerlin", 36.1716, -115.3311],
    ],
  },
  {
    name: "Phoenix Metro",
    slug: "phoenix-metro",
    cities: [
      ["Phoenix", 33.4484, -112.074],
      ["Mesa", 33.4152, -111.8315],
      ["Scottsdale", 33.4942, -111.9261],
      ["Tempe", 33.4255, -111.94],
      ["Chandler", 33.3062, -111.8413],
    ],
  },

  // Mountain West
  {
    name: "Denver Metro",
    slug: "denver-metro",
    cities: [
      ["Denver", 39.7392, -104.9903],
      ["Aurora", 39.7294, -104.8319],
      ["Boulder", 40.015, -105.2705],
      ["Lakewood", 39.7047, -105.0814],
      ["Fort Collins", 40.5853, -105.0844],
    ],
  },
  {
    name: "Salt Lake City Metro",
    slug: "salt-lake-city-metro",
    cities: [
      ["Salt Lake City", 40.7608, -111.891],
      ["Provo", 40.2338, -111.6585],
      ["West Valley City", 40.6916, -112.0011],
      ["Ogden", 41.223, -111.9738],
    ],
  },

  // Texas
  {
    name: "Austin Metro",
    slug: "austin-metro",
    cities: [
      ["Austin", 30.2672, -97.7431],
      ["Round Rock", 30.5083, -97.6789],
      ["Cedar Park", 30.5052, -97.8203],
      ["Georgetown", 30.6333, -97.677],
      ["San Marcos", 29.8833, -97.9414],
    ],
  },
  {
    name: "Dallas-Fort Worth Metro",
    slug: "dallas-fort-worth-metro",
    cities: [
      ["Dallas", 32.7767, -96.797],
      ["Fort Worth", 32.7555, -97.3308],
      ["Arlington", 32.7357, -97.1081],
      ["Plano", 33.0198, -96.6989],
      ["Irving", 32.814, -96.9489],
      ["Frisco", 33.1507, -96.8236],
    ],
  },
  {
    name: "Houston Metro",
    slug: "houston-metro",
    cities: [
      ["Houston", 29.7604, -95.3698],
      ["Sugar Land", 29.6197, -95.6349],
      ["The Woodlands", 30.1658, -95.4613],
      ["Pasadena", 29.6911, -95.2091],
      ["Katy", 29.7858, -95.8245],
    ],
  },
  {
    name: "San Antonio Metro",
    slug: "san-antonio-metro",
    cities: [
      ["San Antonio", 29.4241, -98.4936],
      ["New Braunfels", 29.703, -98.1245],
      ["Schertz", 29.5522, -98.2833],
    ],
  },

  // Midwest
  {
    name: "Chicago Metro",
    slug: "chicago-metro",
    cities: [
      ["Chicago", 41.8781, -87.6298],
      ["Naperville", 41.7508, -88.1535],
      ["Evanston", 42.0451, -87.6877],
      ["Schaumburg", 42.0334, -88.0834],
      ["Oak Park", 41.885, -87.7845],
      ["Aurora", 41.7606, -88.3201],
    ],
  },
  {
    name: "Minneapolis-St. Paul Metro",
    slug: "minneapolis-st-paul-metro",
    cities: [
      ["Minneapolis", 44.9778, -93.265],
      ["St. Paul", 44.9537, -93.09],
      ["Bloomington", 44.8408, -93.2983],
      ["Edina", 44.8897, -93.3499],
      ["Minnetonka", 44.9133, -93.4687],
    ],
  },
  {
    name: "Detroit Metro",
    slug: "detroit-metro",
    cities: [
      ["Detroit", 42.3314, -83.0458],
      ["Ann Arbor", 42.2808, -83.743],
      ["Dearborn", 42.3223, -83.1763],
      ["Troy", 42.6064, -83.1498],
      ["Warren", 42.5145, -83.0146],
    ],
  },
  {
    name: "St. Louis Metro",
    slug: "st-louis-metro",
    cities: [
      ["St. Louis", 38.627, -90.1994],
      ["Clayton", 38.6412, -90.3237],
      ["Chesterfield", 38.6631, -90.5771],
      ["St. Charles", 38.7881, -90.4974],
    ],
  },

  // Southeast
  {
    name: "Atlanta Metro",
    slug: "atlanta-metro",
    cities: [
      ["Atlanta", 33.749, -84.388],
      ["Marietta", 33.9526, -84.5499],
      ["Alpharetta", 34.0754, -84.2941],
      ["Decatur", 33.7748, -84.2963],
      ["Sandy Springs", 33.9304, -84.3733],
    ],
  },
  {
    name: "Miami Metro",
    slug: "miami-metro",
    cities: [
      ["Miami", 25.7617, -80.1918],
      ["Fort Lauderdale", 26.1224, -80.1373],
      ["Boca Raton", 26.3683, -80.1289],
      ["Hialeah", 25.8576, -80.2781],
      ["Coral Gables", 25.7215, -80.2684],
    ],
  },
  {
    name: "Nashville Metro",
    slug: "nashville-metro",
    cities: [
      ["Nashville", 36.1627, -86.7816],
      ["Franklin", 35.9251, -86.8689],
      ["Murfreesboro", 35.8456, -86.3903],
      ["Brentwood", 35.994, -86.7828],
    ],
  },
  {
    name: "Charlotte Metro",
    slug: "charlotte-metro",
    cities: [
      ["Charlotte", 35.2271, -80.8431],
      ["Concord", 35.4088, -80.5795],
      ["Gastonia", 35.2621, -81.1873],
      ["Huntersville", 35.4107, -80.8428],
    ],
  },

  // Northeast
  {
    name: "New York Metro",
    slug: "new-york-metro",
    cities: [
      ["New York", 40.7128, -74.006],
      ["Jersey City", 40.7178, -74.0431],
      ["Newark", 40.7357, -74.1724],
      ["Yonkers", 40.9312, -73.8988],
      ["White Plains", 41.034, -73.7629],
      ["Hoboken", 40.7439, -74.0324],
    ],
  },
  {
    name: "Greater Boston",
    slug: "greater-boston",
    cities: [
      ["Boston", 42.3601, -71.0589],
      ["Cambridge", 42.3736, -71.1097],
      ["Somerville", 42.3876, -71.0995],
      ["Quincy", 42.2529, -71.0023],
      ["Newton", 42.337, -71.2092],
    ],
  },
  {
    name: "Philadelphia Metro",
    slug: "philadelphia-metro",
    cities: [
      ["Philadelphia", 39.9526, -75.1652],
      ["Camden", 39.9259, -75.1196],
      ["King of Prussia", 40.0879, -75.3971],
      ["Cherry Hill", 39.9348, -74.9994],
    ],
  },
  {
    name: "Washington DC Metro",
    slug: "washington-dc-metro",
    cities: [
      ["Washington", 38.9072, -77.0369],
      ["Arlington", 38.8816, -77.091],
      ["Alexandria", 38.8048, -77.0469],
      ["Bethesda", 38.9847, -77.0947],
      ["Silver Spring", 38.9907, -77.0261],
    ],
  },
];

async function main() {
  const regionsByName = new Map<string, { id: string }>();

  for (const r of regions) {
    const region = await prisma.region.upsert({
      where: { slug: r.slug },
      update: {},
      create: { name: r.name, slug: r.slug },
    });
    regionsByName.set(r.name, region);

    for (const [name, latitude, longitude] of r.cities) {
      await prisma.city.upsert({
        where: { name_regionId: { name, regionId: region.id } },
        update: { latitude, longitude },
        create: { name, regionId: region.id, latitude, longitude },
      });
    }
  }

  const bayArea = regionsByName.get("Bay Area")!;
  const uciArea = regionsByName.get("UC Irvine Area")!;

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
