import { MAX_UPLOAD_BYTES, type AiAgent } from "@ether/shared";
import { useCallback, useRef, useState } from "react";
import { useApi } from "../../lib/client/context";
import type { CurrentUser, UiTool, WorkspaceAccess } from "../../lib/contracts";
import { describeError } from "../../lib/errors";
import { formatBytes } from "../../lib/format";
import { markdownToDoc } from "../../lib/markdown";
import { DialogContainerProvider } from "../../lib/runtime";
import { showToast } from "../../lib/toast";
import { AiErrorNotice } from "../ai/AiErrorNotice";
import { AiProvider, useAiConsent } from "../ai/AiProvider";
import { SettingsDialog } from "../ai/SettingsDialog";
import { UsageBadge } from "../ai/UsageBadge";
import { composePrompt } from "../ai/prompt";
import { useGenerate } from "../ai/useGenerate";
import { HistoryPanel } from "../history/HistoryPanel";
import { capabilitiesFor } from "./access";
import { BottomBar } from "./BottomBar";
import { Canvas } from "./Canvas";
import type { EditorHandle } from "./editor/handle";
import { useCollab } from "./editor/useCollab";
import { agentOption, doneMessage, toAiTool, toolOption } from "./tools";
import { ToolPills } from "./ToolPills";
import styles from "./workspace.module.css";

export interface WorkspacePageProps {
  readonly access: WorkspaceAccess;
  readonly user: CurrentUser;
  /** The shell topbar's search text; filters the history list. */
  readonly searchQuery?: string;
  readonly onClearSearch?: () => void;
  /** The shell's Settings trigger drives this. */
  readonly settingsOpen: boolean;
  readonly onSettingsOpenChange: (open: boolean) => void;
  /** Role changed while connected: the shell should refetch /api/me and pass fresh access. */
  readonly onAccessStale?: () => void;
}

export function WorkspacePage(props: WorkspacePageProps) {
  const [card, setCard] = useState<HTMLElement | null>(null);
  return (
    <DialogContainerProvider value={card}>
      <AiProvider>
        <div className={styles["workspaceLayout"]}>
          <main className={styles["workspaceCard"]} ref={setCard}>
            <WorkspaceCard {...props} />
          </main>
          <HistoryPanelContainer {...props} />
        </div>
      </AiProvider>
    </DialogContainerProvider>
  );
}

function HistoryPanelContainer({ access, searchQuery, onClearSearch }: WorkspacePageProps) {
  const caps = capabilitiesFor(access);
  return (
    <HistoryPanel
      workspaceId={access.workspaceId}
      canList={caps.canListHistory}
      canRestore={caps.canRestore}
      canSummarize={caps.canSummarize}
      {...(searchQuery === undefined ? {} : { query: searchQuery })}
      {...(onClearSearch === undefined ? {} : { onClearQuery: onClearSearch })}
    />
  );
}

function WorkspaceCard({ access, user, settingsOpen, onSettingsOpenChange, onAccessStale }: WorkspacePageProps) {
  const api = useApi();
  const caps = capabilitiesFor(access);
  const { requestConsent } = useAiConsent();
  const generate = useGenerate();

  const [tool, setTool] = useState<UiTool>("write");
  const [agent, setAgent] = useState<AiAgent>("default");
  const [web, setWeb] = useState(false);
  const editorRef = useRef<EditorHandle | null>(null);
  const onReady = useCallback((handle: EditorHandle | null) => {
    editorRef.current = handle;
  }, []);
  const noop = useCallback(() => undefined, []);

  const collab = useCollab(access.workspaceId, caps.canConnect, onAccessStale ?? noop);
  const generating = generate.state.status === "streaming";
  const aiTool = toAiTool(tool);
  const generateAvailable = caps.canRunAi && aiTool !== null;

  const onToolChange = (next: UiTool): void => {
    setTool(next);
    showToast(`Switched mode to ${toolOption(next).label}`);
  };

  const onGenerate = async (): Promise<void> => {
    if (!caps.canRunAi) {
      showToast("Your role can't use AI in this workspace");
      return;
    }
    if (aiTool === null) {
      showToast(`${toolOption(tool).label} isn't available yet`);
      return;
    }
    const editor = editorRef.current;
    if (editor === null) {
      showToast("The editor is still loading");
      return;
    }
    // Read before any dialog opens: the prompt is the selection, or else the document.
    const composed = composePrompt({ selection: editor.getSelectionText(), document: editor.getDocumentText() });
    if (!composed.ok) {
      showToast("Write a prompt on the canvas, or select text to use");
      return;
    }
    if (!(await requestConsent())) return;
    if (composed.truncated) showToast("Your text was long, so only part of it was sent");
    showToast(`Generating draft via ${agentOption(agent).label}...`);

    const text = await generate.run({ workspaceId: access.workspaceId, tool: aiTool, agent, prompt: composed.prompt, web });
    if (text === null) return;
    const inserted = editorRef.current?.insertAiBlock(markdownToDoc(text), user.name) ?? false;
    showToast(inserted ? doneMessage(aiTool) : "Couldn't add the draft to the document");
  };

  const onFile = (file: File): void => {
    if (access.orgId === null) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(`That file is too large (max ${formatBytes(MAX_UPLOAD_BYTES)})`);
      return;
    }
    api.uploadToPublicWorkspace(access.orgId, file).then(
      () => showToast(`Uploaded ${file.name} to the Public Workspace`),
      (err: unknown) => showToast(describeError(err).message),
    );
  };

  const onUploadBlocked = (): void => {
    showToast(
      access.scope === "personal"
        ? "Uploads go to an organisation's Public Workspace"
        : "Your role can't upload to the Public Workspace",
    );
  };

  return (
    <>
      <div className={styles["workspaceHeader"]}>
        <UsageBadge kind="generations" />
        <h1 className={styles["workspaceTitle"]}>What would you like to create?</h1>
        <p className={styles["workspaceSubtitle"]}>Draft, generate, plan — all in one workspace.</p>
      </div>

      <ToolPills tool={tool} onChange={onToolChange} />

      <Canvas
        collab={collab}
        user={user}
        editable={caps.canEdit}
        placeholder={toolOption(tool).placeholder}
        onReady={onReady}
      />

      {generate.state.status === "error" && (
        <AiErrorNotice
          error={generate.state.error}
          onDismiss={generate.dismissError}
          onAddKey={caps.canManageAiKey ? () => onSettingsOpenChange(true) : undefined}
        />
      )}

      <BottomBar
        agent={agent}
        onAgentChange={(next) => {
          setAgent(next);
          showToast(`Active agent: ${agentOption(next).label}`);
        }}
        web={web}
        onWebChange={(next) => {
          setWeb(next);
          showToast(next ? "Web Access enabled" : "Web Access disabled");
        }}
        canUpload={caps.canUpload}
        onUploadBlocked={onUploadBlocked}
        onFile={onFile}
        generating={generating}
        generateAvailable={generateAvailable}
        onGenerate={() => void onGenerate()}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={onSettingsOpenChange}
        orgId={access.orgId}
        canManageKey={caps.canManageAiKey}
      />
    </>
  );
}
