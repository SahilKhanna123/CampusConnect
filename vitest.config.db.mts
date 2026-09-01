import { defineConfig } from "vitest/config";

// DB-backed integration tests (npm run test:db) -- exercise real Prisma
// queries/transactions against the disposable local Postgres started by
// `npm run db:test:up` (docker-compose.test.yml). Kept as a SEPARATE config
// from vitest.config.mts (rather than one config with two projects) so
// `npm run test` stays fast and infra-free for day-to-day work: this config
// is only ever invoked via `npm run test:db`, which loads .env.test first.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    exclude: ["**/node_modules/**"],
    // Every *.db.test.ts file shares ONE truncated-per-test Postgres
    // instance (src/lib/testDb.ts resets it in beforeEach) -- running
    // files in parallel (Vitest's default) would let one file's truncate
    // race another file's in-flight assertions. Sequential execution is
    // required for correctness here, not just a performance choice.
    fileParallelism: false,
  },
});
