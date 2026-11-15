const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Architecture §5: validate Origin on state-changing requests and WebSocket upgrades. */
export function isOriginAllowed(req: Request, appOrigin: string): boolean {
  const isUpgrade = req.headers.get("Upgrade")?.toLowerCase() === "websocket";
  if (SAFE_METHODS.has(req.method) && !isUpgrade) return true;
  return req.headers.get("Origin") === appOrigin;
}
