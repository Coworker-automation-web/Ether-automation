import { Outlet, type RouteObject } from "react-router-dom";
import { NotFound, RouteError, RouteLoading } from "./boundaries";
import { AppHome, OrgSettings } from "./placeholders";

/**
 * Paths: /app, /app/o/:orgId/w/:workspaceId, /app/o/:orgId/settings.
 * The workspace route is loaded lazily, so the editor and its libraries stay out of the first load.
 */
export const routes: RouteObject[] = [
  {
    path: "/app",
    element: <Outlet />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <RouteLoading />,
    children: [
      { index: true, element: <AppHome /> },
      { path: "o/:orgId/w/:workspaceId", lazy: () => import("./WorkspaceRoute") },
      { path: "o/:orgId/settings", element: <OrgSettings /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];
