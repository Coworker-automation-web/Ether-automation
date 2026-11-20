import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { CloseIcon } from "./icons";
import { useDialogContainer } from "./runtime";
import styles from "./ui.module.css";

export interface ModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The prototype's floating settings card (backdrop over the workspace card) on a Radix Dialog:
 * focus trap, Escape, focus return and aria wiring come from the primitive; the look is the prototype's.
 */
export function Modal({ open, onOpenChange, title, description, icon, children }: ModalProps) {
  const container = useDialogContainer();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container ?? null}>
        <Dialog.Overlay className={styles["modalBackdrop"]}>
          <Dialog.Content className={styles["settingsCard"]}>
            <div className={styles["settingsCardHeader"]}>
              <Dialog.Title className={styles["settingsCardTitle"]}>
                {icon}
                <span>{title}</span>
              </Dialog.Title>
              <Dialog.Close className={styles["btnCloseModal"]} aria-label="Close">
                <CloseIcon />
              </Dialog.Close>
            </div>
            <Dialog.Description className={styles["settingsCardSubtitle"]}>{description}</Dialog.Description>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
