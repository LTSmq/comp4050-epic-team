import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Compile JSX the same way Next.js does (needed for page/layout tests).
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Undo vi.stubEnv / vi.stubGlobal after every test.
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
