import type { AiAgent } from "@ether/shared";
import { useRef } from "react";
import { cx } from "../../lib/cx";
import { GlobeIcon, PlaySolidIcon, PlusIcon } from "../../lib/icons";
import ui from "../../lib/ui.module.css";
import { AgentMenu } from "./AgentMenu";
import styles from "./workspace.module.css";

export interface BottomBarProps {
  readonly agent: AiAgent;
  readonly onAgentChange: (agent: AiAgent) => void;
  readonly web: boolean;
  readonly onWebChange: (web: boolean) => void;
  readonly canUpload: boolean;
  readonly onUploadBlocked: () => void;
  readonly onFile: (file: File) => void;
  readonly generating: boolean;
  /** Dimmed when the current role/tool cannot generate; still focusable so activation can explain why. */
  readonly generateAvailable: boolean;
  readonly onGenerate: () => void;
}

export function BottomBar(props: BottomBarProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className={styles["workspaceBottomBar"]}>
      <div className={styles["workspaceBottomLeft"]}>
        <input
          ref={fileInput}
          type="file"
          className={styles["hiddenInput"]}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) props.onFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className={ui["btnCircleAdd"]}
          title="Upload to the Public Workspace"
          aria-label="Upload a file to the Public Workspace"
          onClick={() => (props.canUpload ? fileInput.current?.click() : props.onUploadBlocked())}
        >
          <PlusIcon />
        </button>

        <AgentMenu agent={props.agent} onChange={props.onAgentChange} />

        <button
          type="button"
          className={cx(ui["dropdownPill"], props.web && ui["active"])}
          aria-pressed={props.web}
          onClick={() => props.onWebChange(!props.web)}
        >
          <span className={cx(ui["badgeDot"], ui["green"], styles["webDot"])} aria-hidden="true" />
          <GlobeIcon />
          <span>Web Access</span>
        </button>
      </div>

      <button
        type="button"
        className={cx(ui["btnPrimary"], props.generating && ui["loading"], !props.generateAvailable && ui["unavailable"])}
        aria-disabled={props.generating || !props.generateAvailable}
        aria-busy={props.generating}
        onClick={() => {
          if (!props.generating) props.onGenerate();
        }}
      >
        <PlaySolidIcon />
        <span>{props.generating ? "Drafting..." : "Generate"}</span>
      </button>
    </div>
  );
}
