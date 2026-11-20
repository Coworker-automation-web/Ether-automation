import type { AiUsageResponse } from "@ether/shared";
import { BoltIcon, StarIcon } from "../../lib/icons";
import ui from "../../lib/ui.module.css";
import { useAiUsage } from "./hooks";

export type UsageKind = "generations" | "summaries";

export function usageLabel(usage: AiUsageResponse | undefined, kind: UsageKind): string {
  const base = kind === "generations" ? "Powered by Gemini" : "Summaries by Gemini";
  if (!usage) return base;
  const { used, limit } = usage[kind];
  return `${base} · ${Math.max(0, limit - used)} left today`;
}

/** The prototype's "Powered by API Key N" pill, showing what the caller has left today instead. */
export function UsageBadge({ kind }: { kind: UsageKind }) {
  const usage = useAiUsage();
  const isGenerations = kind === "generations";
  return (
    <div className={ui["badgePill"]}>
      <span className={`${ui["badgeDot"]} ${isGenerations ? ui["orange"] : ui["green"]}`} aria-hidden="true" />
      <span>{usageLabel(usage.data, kind)}</span>
      {isGenerations ? <BoltIcon className={ui["badgeIcon"]} /> : <StarIcon className={ui["badgeIcon"]} />}
    </div>
  );
}
