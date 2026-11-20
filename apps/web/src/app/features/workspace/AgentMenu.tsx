import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AI_AGENTS, type AiAgent } from "@ether/shared";
import { AgentStarIcon, ChevronDownIcon } from "../../lib/icons";
import { useDialogContainer } from "../../lib/runtime";
import ui from "../../lib/ui.module.css";
import { AGENTS, agentOption } from "./tools";
import styles from "./workspace.module.css";

const isAgent = (value: string): value is AiAgent => (AI_AGENTS as readonly string[]).includes(value);

export function AgentMenu({ agent, onChange }: { agent: AiAgent; onChange: (agent: AiAgent) => void }) {
  const container = useDialogContainer();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={ui["dropdownPill"]} aria-label={`Agent: ${agentOption(agent).label}`}>
        <AgentStarIcon />
        <span>{agentOption(agent).label}</span>
        <ChevronDownIcon style={{ width: 11, height: 11 }} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={container ?? null}>
        <DropdownMenu.Content className={styles["agentMenu"]} side="top" align="start" sideOffset={8}>
          <DropdownMenu.RadioGroup value={agent} onValueChange={(value) => isAgent(value) && onChange(value)}>
            {AGENTS.map((option) => (
              <DropdownMenu.RadioItem key={option.value} value={option.value} className={styles["agentItem"]}>
                <span aria-hidden="true">{option.glyph}</span>
                <span>{option.label}</span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
