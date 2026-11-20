import type { AI_PROVIDERS, AiTool, Role } from "@ether/shared";

/** The part of the signed-in user the workspace UI needs. A subset of shared `User`. */
export interface CurrentUser {
  readonly id: string;
  readonly name: string;
}

/**
 * Everything the workspace needs to know about the caller's access. The shell resolves it from the
 * route and `GET /api/me` and passes it in; permission decisions are made with shared `can()` only.
 */
export interface WorkspaceAccess {
  readonly workspaceId: string;
  readonly scope: "personal" | "organisation";
  /** Null for personal workspaces. */
  readonly orgId: string | null;
  /** The caller's current role in the org; null for personal workspaces or non-members. */
  readonly role: Role | null;
  /** Personal workspace: the caller owns it. */
  readonly isOwner: boolean;
  /** Executive holds an explicit AI-key delegation from the Admin. */
  readonly aiKeyDelegated: boolean;
}

// TODO(shared): the prototype has "Generate Image" and "More" tools that are not in AI_TOOLS.
// They render but cannot generate until the contract adds them.
export type UiTool = AiTool | "image" | "more";

// TODO(shared): editor document node shape (TipTap / ProseMirror JSON). The Yjs fragment name is
// already in shared `YJS.TEXT_FRAGMENT`; the node vocabulary is not.
export interface DocMark {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
}

export interface DocNode {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly content?: readonly DocNode[];
  readonly marks?: readonly DocMark[];
  readonly text?: string;
}

// TODO(shared): the body of POST /api/orgs/:orgId/ai-keys/test is not specified. Assumed: the
// typed key is tested without being stored; with no key, the stored key is tested.
export interface TestAiKeyRequest {
  readonly provider: (typeof AI_PROVIDERS)[number];
  readonly apiKey?: string;
}
