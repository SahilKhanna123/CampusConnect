import { defineConfig } from "vitest/config";

// Unit tests only for now (pure functions, no DB) -- Node environment, no
// jsdom/React plugin needed yet. resolve.tsconfigPaths lets test files use
// the same "@/lib/..." aliases as the app code, reading directly from
// tsconfig.json rather than duplicating the path mapping here.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
