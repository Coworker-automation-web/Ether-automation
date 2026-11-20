import type { ComponentType, SVGProps } from "react";
import type { UiTool } from "../../lib/contracts";
import { BlueprintIcon, ChevronDownIcon, ImageIcon, PenIcon, PlayIcon } from "../../lib/icons";
import ui from "../../lib/ui.module.css";
import { cx } from "../../lib/cx";
import { TOOLS } from "./tools";
import styles from "./workspace.module.css";

const ICONS: Record<UiTool, ComponentType<SVGProps<SVGSVGElement>> | null> = {
  write: PenIcon,
  image: ImageIcon,
  plan: PlayIcon,
  blueprint: BlueprintIcon,
  more: null,
};

export function ToolPills({ tool, onChange }: { tool: UiTool; onChange: (tool: UiTool) => void }) {
  return (
    <div className={styles["toolPills"]} role="group" aria-label="Tools">
      {TOOLS.map((option) => {
        const Icon = ICONS[option.value];
        const active = option.value === tool;
        return (
          <button
            key={option.value}
            type="button"
            className={cx(ui["btnOutline"], active && ui["active"])}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {Icon !== null && <Icon />}
            <span>{option.label}</span>
            {option.value === "more" && <ChevronDownIcon className={styles["chevronSmall"]} />}
          </button>
        );
      })}
    </div>
  );
}
