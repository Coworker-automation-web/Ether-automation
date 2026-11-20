import { useEffect, useState, useSyncExternalStore } from "react";
import { StarIcon } from "./icons";
import { toastStore, type ToastItem, type ToastStore } from "./toast";
import styles from "./toast.module.css";

const VISIBLE_MS = 2600;
const EXIT_MS = 250;

function ToastView({ item, store }: { item: ToastItem; store: ToastStore }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const hide = setTimeout(() => setLeaving(true), VISIBLE_MS);
    const remove = setTimeout(() => store.dismiss(item.id), VISIBLE_MS + EXIT_MS);
    return () => {
      clearTimeout(hide);
      clearTimeout(remove);
    };
  }, [item.id, store]);

  return (
    <div className={leaving ? `${styles["toast"]} ${styles["leaving"]}` : styles["toast"]}>
      <StarIcon />
      <span>{item.message}</span>
    </div>
  );
}

/**
 * Renders the toast store. The live region exists before any message so assistive tech announces
 * additions; messages are React text nodes only.
 */
export function ToastHost({ store = toastStore }: { store?: ToastStore }) {
  const items = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return (
    <div className={styles["container"]} role="status" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <ToastView key={item.id} item={item} store={store} />
      ))}
    </div>
  );
}
