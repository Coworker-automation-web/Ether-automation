import type { AiAgent, AiTool } from "@ether/shared";
import type { UiTool } from "../../lib/contracts";

export interface ToolOption {
  readonly value: UiTool;
  readonly label: string;
  readonly placeholder: string;
}

// Labels and placeholder copy are the prototype's.
export const TOOLS: readonly ToolOption[] = [
  { value: "write", label: "Write", placeholder: "Start typing or draft your ideas here..." },
  { value: "image", label: "Generate Image", placeholder: "Describe the image you want to generate with Ether..." },
  { value: "plan", label: "Create Plan", placeholder: "Enter your objective to generate a step-by-step execution plan..." },
  { value: "blueprint", label: "Build Blueprint", placeholder: "Define system architecture or technical blueprint components..." },
  { value: "more", label: "More", placeholder: "Choose from additional AI models and workflow templates..." },
];

export const DEFAULT_PLACEHOLDER = "Start typing or choose a tool above...";

export function toolOption(tool: UiTool): ToolOption {
  return TOOLS.find((t) => t.value === tool) ?? TOOLS[0]!;
}

/** Only tools in the shared contract can generate; the rest render but are not wired (TODO(shared)). */
export function toAiTool(tool: UiTool): AiTool | null {
  return tool === "write" || tool === "plan" || tool === "blueprint" ? tool : null;
}

export interface AgentOption {
  readonly value: AiAgent;
  readonly label: string;
  readonly glyph: string;
}

export const AGENTS: readonly AgentOption[] = [
  { value: "default", label: "Default Agent", glyph: "✦" },
  { value: "fast", label: "Fast Agent", glyph: "⚡" },
  { value: "creative", label: "Creative Agent", glyph: "🎨" },
  { value: "research", label: "Research Agent", glyph: "🔬" },
];

export function agentOption(agent: AiAgent): AgentOption {
  return AGENTS.find((a) => a.value === agent) ?? AGENTS[0]!;
}

const DONE_TOAST: Record<AiTool, string> = {
  write: "Document draft created",
  plan: "Plan created",
  blueprint: "Blueprint created",
};

export function doneMessage(tool: AiTool): string {
  return DONE_TOAST[tool];
}
