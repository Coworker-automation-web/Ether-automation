import { lazy, Suspense, useCallback, useRef, useState, type MouseEvent } from "react";
import type { CurrentUser } from "../../lib/contracts";
import { StarIcon } from "../../lib/icons";
import ui from "../../lib/ui.module.css";
import { canvasMessage } from "./canvasState";
import type { EditorHandle, EditorViewState } from "./editor/handle";
import type { CollabState } from "./editor/useCollab";
import styles from "./workspace.module.css";

// TipTap, Yjs bindings and the editor styles load only when a workspace opens, never with the shell.
const CanvasEditor = lazy(() => import("./editor/CanvasEditor"));

export interface CanvasProps {
  readonly collab: CollabState;
  readonly user: CurrentUser;
  readonly editable: boolean;
  readonly placeholder: string;
  readonly onReady: (handle: EditorHandle | null) => void;
}

export function Canvas({ collab, user, editable, placeholder, onReady }: CanvasProps) {
  const [view, setView] = useState<EditorViewState>({ empty: true, focused: false });
  const handleRef = useRef<EditorHandle | null>(null);

  const onHandle = useCallback(
    (handle: EditorHandle | null) => {
      handleRef.current = handle;
      onReady(handle);
    },
    [onReady],
  );

  const message = canvasMessage(collab, placeholder);
  const showEditor = collab.connection !== null && !message.blocksEditor;
  const showEmpty = message.blocksEditor || !showEditor || (view.empty && !view.focused);
  const offline = showEditor && collab.status === "disconnected";

  const onBoxClick = (event: MouseEvent<HTMLDivElement>): void => {
    // Clicks on the empty canvas focus the editor (prototype behavior); clicks inside it are the editor's own.
    if (event.target === event.currentTarget) handleRef.current?.focus();
  };

  return (
    // The box is a pointer convenience only; the keyboard path is the editor's own textbox.
    <div className={styles["canvasBox"]} onClick={onBoxClick}>
      {offline && (
        <div className={`${ui["badgePill"]} ${styles["offlineBadge"]}`} role="status">
          <span className={`${ui["badgeDot"]} ${ui["orange"]}`} aria-hidden="true" />
          <span>Offline — changes sync when you reconnect</span>
        </div>
      )}
      {showEditor && collab.connection !== null && (
        <Suspense fallback={null}>
          <CanvasEditor
            connection={collab.connection}
            user={user}
            editable={editable}
            onReady={onHandle}
            onViewState={setView}
          />
        </Suspense>
      )}
      {showEmpty && (
        <div className={styles["canvasEmptyState"]} role={message.blocksEditor ? "alert" : "status"}>
          <StarIcon className={styles["canvasStar"]} />
          <div className={styles["canvasText"]}>{message.text}</div>
        </div>
      )}
    </div>
  );
}
