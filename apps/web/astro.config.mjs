import react from "@astrojs/react";
import { defineConfig } from "astro/config";

// Dev only: the app is one static page at /app and React Router handles every /app/* URL in the
// browser, so a reload on a deep link must be answered with that page. Production hosts need the
// equivalent single-page-application fallback.
const appFallback = {
  name: "ether-app-fallback",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const [path = "", query] = (req.url ?? "").split("?");
      if (path.startsWith("/app/")) req.url = query === undefined ? "/app" : `/app?${query}`;
      next();
    });
  },
};

export default defineConfig({
  integrations: [react()],
  server: { port: 4321 },
  vite: { plugins: [appFallback], server: { proxy: { "/api": "http://localhost:8787" } } },
});
