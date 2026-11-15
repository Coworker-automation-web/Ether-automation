import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { errorBody, httpStatusFor } from "@ether/shared";
import type { Env } from "./env";
import { isOriginAllowed } from "./lib/origin";

export { WorkspaceRoom } from "./do/WorkspaceRoom";
export { QuotaGuard } from "./do/QuotaGuard";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  secureHeaders({
    strictTransportSecurity: "max-age=63072000; includeSubDomains",
    xContentTypeOptions: "nosniff",
    xFrameOptions: "DENY",
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  }),
);

app.use("/api/*", async (c, next) => {
  if (!isOriginAllowed(c.req.raw, c.env.APP_ORIGIN)) {
    return c.json(errorBody("bad_origin", "Origin not allowed"), httpStatusFor("bad_origin"));
  }
  await next();
});

app.get("/api/health", (c) => c.json({ ok: true }));

// Phase 2 replaces this with session lookup and the real profile/memberships response.
app.get("/api/me", (c) => c.json(errorBody("unauthenticated", "Sign in required"), httpStatusFor("unauthenticated")));

app.notFound((c) => c.json(errorBody("not_found", "Not found"), httpStatusFor("not_found")));

export default app;
