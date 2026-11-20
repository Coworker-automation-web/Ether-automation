import { putAiKeySchema } from "@ether/shared";
import { useEffect, useRef, useState } from "react";
import { describeError } from "../../lib/errors";
import { ListIcon, PlayIcon, SettingsIcon } from "../../lib/icons";
import { Modal } from "../../lib/modal";
import { showToast } from "../../lib/toast";
import ui from "../../lib/ui.module.css";
import { useAiKeys, usePutAiKey, useTestAiKey } from "./hooks";

export interface SettingsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Null for personal workspaces. */
  readonly orgId: string | null;
  /** Result of shared `can(role, "aikey.manage", ...)`. */
  readonly canManageKey: boolean;
}

type TestState = "idle" | "testing" | "valid" | "invalid";
const RESET_MS = 2500;

export function SettingsDialog({ open, onOpenChange, orgId, canManageKey }: SettingsDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Settings"
      description="Manage your API keys and preferences"
      icon={<SettingsIcon />}
    >
      {orgId !== null && canManageKey ? (
        <KeyForm orgId={orgId} onClose={() => onOpenChange(false)} />
      ) : (
        <ReadOnlyNote personal={orgId === null} onClose={() => onOpenChange(false)} />
      )}
    </Modal>
  );
}

function ReadOnlyNote({ personal, onClose }: { personal: boolean; onClose: () => void }) {
  return (
    <>
      <p className={ui["fieldNote"]}>
        {personal
          ? "Personal workspaces don't have API keys to manage."
          : "API keys for this organisation are managed by its admin."}
      </p>
      <div className={ui["settingsCardActions"]}>
        <button type="button" className={ui["btnCancel"]} onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}

function KeyForm({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const keys = useAiKeys(orgId, true);
  const put = usePutAiKey(orgId);
  const test = useTestAiKey(orgId);
  const [value, setValue] = useState("");
  const [testState, setTestState] = useState<TestState>("idle");
  const [error, setError] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    },
    [],
  );

  const stored = keys.data?.[0];
  const typed = value.trim();

  const scheduleReset = (): void => {
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setTestState("idle"), RESET_MS);
  };

  const onTest = (): void => {
    if (typed === "" && !stored) {
      setError("Enter a key to test.");
      return;
    }
    setError(null);
    setTestState("testing");
    test.mutate(
      { provider: "gemini", ...(typed === "" ? {} : { apiKey: typed }) },
      {
        onSuccess: (result) => {
          if (result.ok) {
            setTestState("valid");
            showToast("Gemini key verified successfully");
          } else {
            setTestState("invalid");
            setError(result.message ?? "That key was rejected.");
          }
          scheduleReset();
        },
        onError: (err) => {
          setTestState("idle");
          setError(describeError(err).message);
        },
      },
    );
  };

  const onSave = (): void => {
    const parsed = putAiKeySchema.safeParse({ provider: "gemini", apiKey: typed });
    if (!parsed.success) {
      setError("API keys are at least 20 characters.");
      return;
    }
    setError(null);
    put.mutate(parsed.data.apiKey, {
      onSuccess: () => {
        showToast("API key saved");
        onClose();
      },
      onError: (err) => setError(describeError(err).message),
    });
  };

  const testLabel = testState === "testing" ? "Testing..." : testState === "valid" ? "✓ Valid" : "Test";

  return (
    <>
      <div className={ui["settingsGroup"]}>
        <div className={ui["settingsGroupHeader"]}>
          <div className={ui["settingsIconBox"]}>
            <ListIcon />
          </div>
          <div className={ui["settingsGroupText"]}>
            <h4>AI Generation &amp; Summaries</h4>
            <p>Used for drafting in the workspace and summarising history.</p>
          </div>
        </div>
        <div className={ui["settingsInputRow"]}>
          <div className={ui["settingsInputWrapper"]}>
            {/* Secrets are masked, unlike the prototype's plain text field, and never stored in the browser. */}
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              aria-label="Gemini API key"
              placeholder={stored ? `Saved key ••••${stored.last4} — enter a new key to replace` : "Enter Gemini API Key"}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
            />
          </div>
          <button
            type="button"
            className={`${ui["btnTest"]} ${testState === "valid" ? ui["btnTestValid"] : ""}`}
            onClick={onTest}
            disabled={testState === "testing"}
          >
            <PlayIcon />
            <span>{testLabel}</span>
          </button>
        </div>
        {error !== null && (
          <p className={ui["fieldError"]} role="alert">
            {error}
          </p>
        )}
        {keys.isError && <p className={ui["fieldNote"]}>Couldn&apos;t load the saved key.</p>}
      </div>

      <div className={ui["settingsCardActions"]}>
        <button type="button" className={ui["btnCancel"]} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={ui["btnSave"]} onClick={onSave} disabled={typed === "" || put.isPending}>
          {put.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </>
  );
}
