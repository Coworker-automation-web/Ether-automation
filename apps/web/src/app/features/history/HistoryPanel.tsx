import * as Tabs from "@radix-ui/react-tabs";
import { useState, type ReactNode } from "react";
import { describeError } from "../../lib/errors";
import { ChevronRightIcon, FileIcon, ListIcon } from "../../lib/icons";
import { showToast } from "../../lib/toast";
import { useNowSeconds } from "../../lib/use-now";
import { UsageBadge } from "../ai/UsageBadge";
import { useSnapshots } from "../../lib/queries";
import { filterSnapshots, HISTORY_TABS, snapshotMeta, snapshotTitle, type HistoryTab } from "./model";
import { RestoreDialog } from "./RestoreDialog";
import styles from "./history.module.css";

export interface HistoryPanelProps {
  readonly workspaceId: string;
  /** shared can(..., "history.list") */
  readonly canList: boolean;
  /** shared can(..., "restore") */
  readonly canRestore: boolean;
  /** shared can(..., "ai.summarize") */
  readonly canSummarize: boolean;
  /** The shell topbar's search text. */
  readonly query?: string;
  readonly onClearQuery?: () => void;
}

const isTab = (value: string): value is HistoryTab => HISTORY_TABS.some((t) => t.value === value);

export function HistoryPanel({ workspaceId, canList, canRestore, canSummarize, query = "", onClearQuery }: HistoryPanelProps) {
  const snapshots = useSnapshots(workspaceId, { enabled: canList });
  const nowSec = useNowSeconds();
  const [tab, setTab] = useState<HistoryTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const all = snapshots.data ?? [];
  const visible = filterSnapshots(all, { tab, query, nowSec });
  const selected = selectedId === null ? null : (all.find((s) => s.id === selectedId) ?? null);

  const viewAll = (): void => {
    setTab("all");
    onClearQuery?.();
    showToast(`Showing all ${all.length} workspace history records`);
  };

  return (
    <aside className={styles["historyPanel"]} aria-label="Version history">
      <div className={styles["historyHeader"]}>
        <h2 className={styles["historyTitle"]}>Active History</h2>
        <UsageBadge kind="summaries" />
      </div>

      <Tabs.Root value={tab} onValueChange={(value) => isTab(value) && setTab(value)}>
        <Tabs.List className={styles["historyTabs"]} aria-label="Filter versions">
          {HISTORY_TABS.map((t) => (
            <Tabs.Trigger key={t.value} value={t.value} className={styles["historyTab"]}>
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value={tab}>
          <Body
            canList={canList}
            loading={snapshots.isPending}
            error={snapshots.isError ? describeError(snapshots.error).message : null}
            onRetry={() => void snapshots.refetch()}
            total={all.length}
          >
            <ul className={styles["historyList"]}>
              {visible.map((snapshot) => (
                <li key={snapshot.id}>
                  <button
                    type="button"
                    className={
                      snapshot.id === selectedId ? `${styles["historyItem"]} ${styles["selected"]}` : styles["historyItem"]
                    }
                    aria-haspopup="dialog"
                    onClick={() => setSelectedId(snapshot.id)}
                  >
                    <span className={styles["historyItemIcon"]}>
                      <FileIcon />
                    </span>
                    <span className={styles["historyItemContent"]}>
                      <span className={styles["historyItemTitle"]}>{snapshotTitle(snapshot)}</span>
                      <span className={styles["historyItemMeta"]}>{snapshotMeta(snapshot, nowSec)}</span>
                    </span>
                    <span className={styles["historyItemArrow"]}>
                      <ChevronRightIcon />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {visible.length === 0 && (
              <div className={styles["state"]}>
                {query.trim() === "" ? "Nothing in this view yet." : `No versions match "${query.trim()}".`}
              </div>
            )}
          </Body>
        </Tabs.Content>
      </Tabs.Root>

      {canList && all.length > 0 && (
        <button type="button" className={styles["btnViewAll"]} onClick={viewAll}>
          <ListIcon />
          <span>View all history</span>
        </button>
      )}

      {selected !== null && (
        <RestoreDialog
          key={selected.id}
          workspaceId={workspaceId}
          snapshot={selected}
          nowSec={nowSec}
          canRestore={canRestore}
          canSummarize={canSummarize}
          onClose={() => setSelectedId(null)}
        />
      )}
    </aside>
  );
}

interface BodyProps {
  readonly canList: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly total: number;
  readonly onRetry: () => void;
  readonly children: ReactNode;
}

/** Loading, no-access, error and empty states around the list; the list itself is passed in once data exists. */
function Body({ canList, loading, error, total: count, onRetry, children }: BodyProps) {
  if (!canList) return <div className={styles["state"]}>You don&apos;t have access to this workspace&apos;s history.</div>;
  if (loading) {
    return (
      <div className={styles["state"]} role="status">
        Loading history…
      </div>
    );
  }
  if (error !== null) {
    return (
      <div className={styles["state"]} role="alert">
        <span>{error}</span>
        <button type="button" className={styles["btnViewAll"]} onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  if (count === 0) {
    return <div className={styles["state"]}>No versions yet. Versions are saved automatically as you write.</div>;
  }
  return <>{children}</>;
}
