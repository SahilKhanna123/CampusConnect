import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// DB-backed test helper -- requires a live Postgres connection. Only ever
// import this from a *.db.test.ts file (run via `npm run test:db`, which
// loads .env.test first). Never import this from a plain *.test.ts file --
// those run under `npm run test` with no DATABASE_URL guaranteed at all,
// and even if one happened to be set, resetTestDb() below is destructive.

const rawUrl = process.env.DATABASE_URL ?? "";

// Load-bearing safety guard: resetTestDb() runs a destructive
// TRUNCATE ... CASCADE across every table. This check exists so a
// misconfigured environment (e.g. someone running `vitest --config
// vitest.config.db.mts` directly, bypassing the `dotenv -e .env.test` that
// npm run test:db normally prepends) fails loudly at import time instead of
// truncating a real database. Checked at MODULE LOAD, not lazily inside
// resetTestDb(), so the guard fires as early as possible.
if (
  !rawUrl.includes("campusconnect_test") ||
  rawUrl.includes(".supabase.co") ||
  rawUrl.includes("pooler.supabase.com")
) {
  throw new Error(
    `testDb.ts refuses to run: DATABASE_URL doesn't look like the disposable local test database ` +
      `(expected it to contain "campusconnect_test", and never ".supabase.co"/"pooler.supabase.com"). ` +
      `Got: ${rawUrl || "(unset)"}. Run DB-backed tests via "npm run test:db", which loads .env.test first.`,
  );
}

// Every model's table, read from the Prisma DMMF at runtime rather than
// hand-maintained -- this list can't silently drift out of sync as models
// get added to schema.prisma. Prisma uses the model name as the table name
// unless @@map overrides it (none of this schema's models do).
const TABLE_NAMES = Prisma.dmmf.datamodel.models.map((m) => m.dbName ?? m.name);

/**
 * Truncates every table (RESTART IDENTITY CASCADE, so FK order doesn't
 * matter). Call this in a `beforeEach`, not `afterEach` -- starting every
 * test from a guaranteed-clean state is more robust than relying on the
 * previous test's cleanup having actually run (e.g. after a crashed or
 * cancelled prior run).
 */
export async function resetTestDb(): Promise<void> {
  if (TABLE_NAMES.length === 0) return;
  const quoted = TABLE_NAMES.map((name) => `"${name}"`).join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );
}

/**
 * Minimal FK-parent rows most DB tests will need: one Region, one City,
 * one SupportedUniversityDomain. Trimmed version of prisma/seed.ts's own
 * pattern -- call after resetTestDb(), not before.
 */
export async function seedReferenceData() {
  const region = await prisma.region.create({
    data: { name: "Test Region", slug: "test-region" },
  });
  const city = await prisma.city.create({
    data: { name: "Test City", regionId: region.id },
  });
  const universityDomain = await prisma.supportedUniversityDomain.create({
    data: {
      domain: "test.edu",
      universityName: "Test University",
      regionId: region.id,
    },
  });
  return { region, city, universityDomain };
}

/** Convenience wrapper: reset, then seed the minimal reference rows. */
export async function resetAndSeed() {
  await resetTestDb();
  return seedReferenceData();
}
