import { defineConfig } from "vitest/config";

export default defineConfig({
  // Astro's tsconfig keeps JSX as-is for its own compiler; tests need the automatic runtime.
  esbuild: { jsx: "automatic" },
  test: { environment: "node", include: ["src/**/*.test.{ts,tsx}"] },
});
