import { useEffect, useState } from "react";

/** Current unix seconds, refreshed on an interval so relative times ("2m ago") stay fresh. */
export function useNowSeconds(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
