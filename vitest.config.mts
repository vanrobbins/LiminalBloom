import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Tests that touch the database need the same connection string the app uses.
config({ path: ".env.local" });

export default defineConfig({
  resolve: {
    alias: {
      // The @/* alias comes from tsconfig.json, which Vitest does not read.
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only` throws on import outside a Server Component, which is
      // the point of it -- but that includes the test runner. The package
      // ships an empty build for exactly this, used by the react-server
      // condition; point Vitest at it so server modules stay testable.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          // Unit tests sit beside the code they test, as lib/*.test.ts.
          include: ["{lib,db,app}/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          // Components render into jsdom: real DOM and ARIA, but no layout.
          // Sizes, colors and gestures are checked by Playwright instead.
          include: ["{components,app}/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
