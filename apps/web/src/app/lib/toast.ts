export interface ToastItem {
  readonly id: number;
  readonly message: string;
}

export interface ToastStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): readonly ToastItem[];
  push(message: string): number;
  dismiss(id: number): void;
}

/** Tiny external store so any feature can raise a toast without prop drilling. */
export function createToastStore(max = 4): ToastStore {
  let items: readonly ToastItem[] = [];
  let nextId = 1;
  const listeners = new Set<() => void>();
  const emit = (): void => listeners.forEach((l) => l());

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => items,
    push(message) {
      const id = nextId++;
      items = [...items, { id, message }].slice(-max);
      emit();
      return id;
    },
    dismiss(id) {
      const next = items.filter((t) => t.id !== id);
      if (next.length === items.length) return;
      items = next;
      emit();
    },
  };
}

export const toastStore: ToastStore = createToastStore();
export const showToast = (message: string): number => toastStore.push(message);
