import { matchRoutes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { routes } from "./routes";

const match = (path: string) => matchRoutes(routes, path)?.map((m) => ({ id: m.route.path ?? "(index)", params: m.params }));

describe("route table", () => {
  it("matches /app to the index route", () => {
    expect(match("/app")?.map((m) => m.id)).toEqual(["/app", "(index)"]);
    expect(match("/app/")?.map((m) => m.id)).toEqual(["/app", "(index)"]);
  });

  it("matches the workspace route and exposes its params", () => {
    const m = match("/app/o/org-1/w/ws-2");
    expect(m?.at(-1)).toEqual({ id: "o/:orgId/w/:workspaceId", params: { orgId: "org-1", workspaceId: "ws-2" } });
  });

  it("matches org settings", () => {
    expect(match("/app/o/org-1/settings")?.at(-1)).toMatchObject({ id: "o/:orgId/settings", params: { orgId: "org-1" } });
  });

  it("sends unknown /app paths to the not-found route and everything else to no route", () => {
    expect(match("/app/nope/at/all")?.at(-1)?.id).toBe("*");
    expect(matchRoutes(routes, "/elsewhere")).toBeNull();
  });

  it("loads only the workspace route lazily and gives the tree error and loading boundaries", () => {
    const root = routes[0]!;
    expect(root.errorElement).toBeDefined();
    expect(root.hydrateFallbackElement).toBeDefined();
    const workspace = root.children?.find((r) => r.path === "o/:orgId/w/:workspaceId");
    expect(workspace?.lazy).toBeTypeOf("function");
    expect(root.children?.find((r) => r.path === "o/:orgId/settings")?.lazy).toBeUndefined();
  });
});
