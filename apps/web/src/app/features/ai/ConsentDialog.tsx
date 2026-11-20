import { BoltIcon } from "../../lib/icons";
import { Modal } from "../../lib/modal";
import ui from "../../lib/ui.module.css";
import styles from "./ai.module.css";

export interface ConsentDialogProps {
  readonly open: boolean;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

/** Architecture §9: AI is opt-in with a clear notice. Dismissing the dialog counts as declining. */
export function ConsentDialog({ open, onAccept, onDecline }: ConsentDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onDecline();
      }}
      title="Turn on AI assistance"
      description="Ether can draft, plan and outline for you."
      icon={<BoltIcon />}
    >
      <p className={styles["noticeText"]}>
        When you generate, the text you have selected (or the whole document if nothing is selected) is sent to
        Google Gemini, an external AI service, to produce a draft. AI output is inserted as a separate block
        labelled with who requested it; it never replaces your text.
      </p>
      <p className={styles["noticeText"]}>
        How the provider may retain or use that text depends on the terms of the key in use. Don&apos;t send
        anything you aren&apos;t allowed to share.
      </p>
      <div className={ui["settingsCardActions"]}>
        <button type="button" className={ui["btnCancel"]} onClick={onDecline}>
          Not now
        </button>
        <button type="button" className={ui["btnSave"]} onClick={onAccept}>
          Turn on AI
        </button>
      </div>
    </Modal>
  );
}
