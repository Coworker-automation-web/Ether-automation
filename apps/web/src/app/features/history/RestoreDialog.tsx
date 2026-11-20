import type { Snapshot } from "@ether/shared";
import { useState } from "react";
import { describeError } from "../../lib/errors";
import { FileIcon } from "../../lib/icons";
import { Modal } from "../../lib/modal";
import { showToast } from "../../lib/toast";
import ui from "../../lib/ui.module.css";
import { useAiConsent } from "../ai/AiProvider";
import aiStyles from "../ai/ai.module.css";
import { useRestore, useSummarize } from "./hooks";
import { snapshotMeta, snapshotTitle } from "./model";

export interface RestoreDialogProps {
  readonly workspaceId: string;
  readonly snapshot: Snapshot;
  readonly nowSec: number;
  readonly canRestore: boolean;
  readonly canSummarize: boolean;
  readonly onClose: () => void;
}

/**
 * Opens when a history item is chosen. There is no snapshot-content endpoint, so a version can be
 * read as its summary and restored, but not previewed in the editor (see report).
 */
export function RestoreDialog({ workspaceId, snapshot, nowSec, canRestore, canSummarize, onClose }: RestoreDialogProps) {
  const restore = useRestore(workspaceId);
  const summarize = useSummarize(workspaceId);
  const { requestConsent } = useAiConsent();
  const [error, setError] = useState<string | null>(null);
  const title = snapshotTitle(snapshot);

  const onRestore = (): void => {
    setError(null);
    restore.mutate(snapshot.id, {
      onSuccess: () => {
        showToast(`Restored "${title}"`);
        onClose();
      },
      onError: (err) => setError(describeError(err).message),
    });
  };

  const onSummarize = async (): Promise<void> => {
    setError(null);
    if (!(await requestConsent())) return;
    summarize.mutate(snapshot.id, { onError: (err) => setError(describeError(err).message) });
  };

  const summarizing = snapshot.summary_status === "pending" || summarize.isPending;

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      description={snapshotMeta(snapshot, nowSec)}
      icon={<FileIcon />}
    >
      {snapshot.summary !== null && snapshot.summary.trim() !== "" ? (
        <p className={aiStyles["noticeText"]}>{snapshot.summary}</p>
      ) : summarizing ? (
        <p className={ui["fieldNote"]} role="status">
          Summarising this version…
        </p>
      ) : canSummarize ? (
        <button type="button" className={ui["btnTest"]} onClick={() => void onSummarize()}>
          Summarise this version
        </button>
      ) : null}

      {canRestore ? (
        <p className={ui["fieldNote"]}>
          Restoring replaces the current document with this version. The current document is saved as a version first,
          so you can come back to it.
        </p>
      ) : (
        <p className={ui["fieldNote"]}>Your role can&apos;t restore versions.</p>
      )}

      {error !== null && (
        <p className={ui["fieldError"]} role="alert">
          {error}
        </p>
      )}

      <div className={ui["settingsCardActions"]}>
        <button type="button" className={ui["btnCancel"]} onClick={onClose}>
          {canRestore ? "Cancel" : "Close"}
        </button>
        {canRestore && (
          <button type="button" className={ui["btnSave"]} onClick={onRestore} disabled={restore.isPending}>
            {restore.isPending ? "Restoring..." : "Restore this version"}
          </button>
        )}
      </div>
    </Modal>
  );
}
