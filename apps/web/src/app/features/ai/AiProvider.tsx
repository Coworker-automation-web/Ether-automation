import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { browserStorage, grantAiConsent, hasAiConsent, type KeyValueStorage } from "../../lib/consent";
import { ConsentDialog } from "./ConsentDialog";

interface AiConsentApi {
  /** True when consent is already given; otherwise opens the notice and resolves with the answer. */
  requestConsent(): Promise<boolean>;
}

const AiConsentContext = createContext<AiConsentApi | null>(null);

export function useAiConsent(): AiConsentApi {
  const ctx = useContext(AiConsentContext);
  if (!ctx) throw new Error("useAiConsent must be used inside <AiProvider>");
  return ctx;
}

export function AiProvider({ children, storage }: { children: ReactNode; storage?: KeyValueStorage | null }) {
  const store = storage === undefined ? browserStorage() : storage;
  // Kept in memory too, so consent holds for the session even if storage is blocked.
  const [granted, setGranted] = useState(() => hasAiConsent(store));
  const [open, setOpen] = useState(false);
  const pending = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    pending.current?.(value);
    pending.current = null;
    setOpen(false);
  }, []);

  const requestConsent = useCallback((): Promise<boolean> => {
    if (granted) return Promise.resolve(true);
    pending.current?.(false);
    return new Promise<boolean>((resolve) => {
      pending.current = resolve;
      setOpen(true);
    });
  }, [granted]);

  const value = useMemo<AiConsentApi>(() => ({ requestConsent }), [requestConsent]);

  return (
    <AiConsentContext.Provider value={value}>
      {children}
      <ConsentDialog
        open={open}
        onDecline={() => settle(false)}
        onAccept={() => {
          grantAiConsent(store);
          setGranted(true);
          settle(true);
        }}
      />
    </AiConsentContext.Provider>
  );
}
