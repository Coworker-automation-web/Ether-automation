import { describe, expect, it } from "vitest";
import { formatBytes, formatRelativeTime, formatResetTime } from "../format";

describe("formatRelativeTime", () => {
  it("uses the prototype's buckets", () => {
    expect(formatRelativeTime(1000, 1000)).toBe("just now");
    expect(formatRelativeTime(1000, 1000 - 120)).toBe("2m ago");
    expect(formatRelativeTime(10_000, 10_000 - 3600)).toBe("1h ago");
    expect(formatRelativeTime(200_000, 200_000 - 2 * 86400)).toBe("2d ago");
  });

  it("never goes negative for future timestamps", () => {
    expect(formatRelativeTime(1000, 2000)).toBe("just now");
  });
});

describe("formatBytes / formatResetTime", () => {
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(10 * 1024 * 1024)).toBe("10.0 MB");
  });

  it("formats a reset time in a given zone", () => {
    expect(formatResetTime(0, { locale: "en-GB", timeZone: "UTC" })).toBe("00:00");
  });
});
