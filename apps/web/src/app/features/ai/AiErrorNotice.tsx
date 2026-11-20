import type { ErrorDescription } from "../../lib/errors";
import { formatResetTime } from "../../lib/format";
import styles from "./ai.module.css";

export interface AiErrorNoticeProps {
  readonly error: ErrorDescription;
  readonly onDismiss: () => void;
  /** Offered only for ai_limit_reached when the caller may add an organisation key. */
  readonly onAddKey?: (() => void) | undefined;
}

/** Designed failure state for generation: what happened, when it resets, and the one useful next step. */
export function AiErrorNotice({ error, onDismiss, onAddKey }: AiErrorNoticeProps) {
  const reset = error.resetAt === undefined ? null : formatResetTime(error.resetAt);
  return (
    <div className={styles["alert"]} role="alert">
      <div className={styles["alertMessage"]}>
        <span className={styles["alertStrong"]}>{error.message}</span>
        {reset !== null && <span> It resets at {reset}.</span>}
      </div>
      {error.suggestAddKey && onAddKey !== undefined && (
        <button type="button" className={styles["alertAction"]} onClick={onAddKey}>
          Add an organisation key
        </button>
      )}
      <button type="button" className={styles["alertAction"]} onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
