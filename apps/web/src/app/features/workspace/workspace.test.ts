import { can } from "@ether/shared";
import { describe, expect, it } from "vitest";
import type { WorkspaceAccess } from "../../lib/contracts";
import { authzContext, capabilitiesFor } from "./access";
import { canvasMessage } from "./canvasState";
import { AGENTS, agentOption, DEFAULT_PLACEHOLDER, doneMessage, TOOLS, toAiTool, toolOption } from "./tools";

const org = (role: WorkspaceAccess["role"], extra: Partial<WorkspaceAccess> = {}): WorkspaceAccess => ({
  workspaceId: "w1",
  scope: "organisation",
  orgId: "o1",
  role,
  isOwner: false,
  aiKeyDelegated: false,
  ...extra,
});
const personal = (isOwner: boolean): WorkspaceAccess => ({
  workspaceId: "w2",
  scope: "personal",
  orgId: null,
  role: null,
  isOwner,
  aiKeyDelegated: false,
});

describe("capabilitiesFor (delegates to shared can())", () => {
  it("viewers can read but not edit, restore or run AI", () => {
    const c = capabilitiesFor(org("viewer"));
    expect(c).toMatchObject({ canConnect: true, canListHistory: true, canEdit: false, canRestore: false, canRunAi: false, canUpload: false });
  });

  it("members can edit, restore, run and summarise AI and upload, but not manage keys", () => {
    const c = capabilitiesFor(org("member"));
    expect(c).toMatchObject({ canEdit: true, canRestore: true, canRunAi: true, canSummarize: true, canUpload: true, canManageAiKey: false });
  });

  it("only admins, or delegated executives, manage the AI key", () => {
    expect(capabilitiesFor(org("admin")).canManageAiKey).toBe(true);
    expect(capabilitiesFor(org("executive")).canManageAiKey).toBe(false);
    expect(capabilitiesFor(org("executive", { aiKeyDelegated: true })).canManageAiKey).toBe(true);
    expect(capabilitiesFor(org("member", { aiKeyDelegated: true })).canManageAiKey).toBe(false);
  });

  it("personal workspaces are owner-only and have no keys or public uploads", () => {
    expect(capabilitiesFor(personal(true))).toMatchObject({ canConnect: true, canEdit: true, canRunAi: true, canManageAiKey: false, canUpload: false });
    expect(Object.values(capabilitiesFor(personal(false))).every((v) => v === false)).toBe(true);
  });

  it("fails closed for non-members of an organisation", () => {
    expect(Object.values(capabilitiesFor(org(null))).every((v) => v === false)).toBe(true);
  });

  it("builds the exact context shared can() expects", () => {
    const access = personal(true);
    expect(authzContext(access)).toEqual({ signedIn: true, workspaceScope: "personal", isOwner: true, aiKeyDelegated: false });
    expect(can(access.role, "ai.run", authzContext(access))).toBe(true);
  });
});

describe("tools and agents", () => {
  it("only contract tools can generate; image and more render but do not", () => {
    expect(toAiTool("write")).toBe("write");
    expect(toAiTool("plan")).toBe("plan");
    expect(toAiTool("blueprint")).toBe("blueprint");
    expect(toAiTool("image")).toBeNull();
    expect(toAiTool("more")).toBeNull();
  });

  it("keeps the prototype's labels and per-tool placeholders", () => {
    expect(TOOLS.map((t) => t.label)).toEqual(["Write", "Generate Image", "Create Plan", "Build Blueprint", "More"]);
    expect(toolOption("plan").placeholder).toContain("step-by-step");
    expect(DEFAULT_PLACEHOLDER).toBe("Start typing or choose a tool above...");
    expect(doneMessage("write")).toBe("Document draft created");
  });

  it("covers every shared agent", () => {
    expect(AGENTS.map((a) => a.value)).toEqual(["default", "fast", "creative", "research"]);
    expect(agentOption("fast").label).toBe("Fast Agent");
  });
});

describe("canvasMessage", () => {
  const base = { closed: null, failed: false, synced: true, connection: {} as never };
  it("shows connecting until the room has synced", () => {
    expect(canvasMessage({ ...base, synced: false }, "ph")).toEqual({ text: "Connecting…", blocksEditor: false });
    expect(canvasMessage({ ...base, connection: null }, "ph").text).toBe("Connecting…");
  });

  it("shows the tool placeholder once ready", () => {
    expect(canvasMessage(base, "ph")).toEqual({ text: "ph", blocksEditor: false });
  });

  it("blocks the editor with designed copy for each terminal state", () => {
    expect(canvasMessage({ ...base, closed: "unauthenticated" }, "ph")).toMatchObject({ blocksEditor: true });
    expect(canvasMessage({ ...base, closed: "forbidden" }, "ph").text).toContain("access");
    expect(canvasMessage({ ...base, closed: "revoked" }, "ph").text).toContain("Reload");
    expect(canvasMessage({ ...base, failed: true }, "ph").blocksEditor).toBe(true);
  });
});
