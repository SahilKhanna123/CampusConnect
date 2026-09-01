import { defineConfig } from "vitest/config";

// Unit tests only for now (pure functions, no DB) -- Node environment, no
// jsdom/React plugin needed yet. resolve.tsconfigPaths lets test files use
// the same "@/lib/..." aliases as the app code, reading directly from
// tsconfig.json rather than duplicating the path mapping here.
//
// *.db.test.ts files are excluded here -- those need a live Postgres
// (npm run test:db, see vitest.config.db.mts) and would otherwise also
// match "src/**/*.test.ts" below, making plain `npm run test` try (and
// fail/hang without Docker running) to collect them too.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/*.db.test.ts"],
  },
});
