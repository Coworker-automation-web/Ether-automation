const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Architecture section 5: validate Origin on state-changing requests and WebSocket upgrades. */
export function isOriginAllowed(req: Request, appOrigin: string): boolean {
  const isUpgrade = req.headers.get("Upgrade")?.toLowerCase() === "websocket";
  if (SAFE_METHODS.has(req.method) && !isUpgrade) return true;
  const origin = req.headers.get("Origin");
  if (!origin) return false;
  // Compare normalised origins so a configured trailing slash or default port cannot break (or loosen) the check.
  try {
    return new URL(origin).origin === new URL(appOrigin).origin;
  } catch {
    return false;
  }
}
