import { Icon } from './Icon';
import styles from './Topbar.module.css';

type TopbarProps = {
  searchPlaceholder?: string;
  /** Initials shown in the avatar button. */
  initials: string;
  onNotificationsClick?: () => void;
  onAccountClick?: () => void;
};

export function Topbar({
  searchPlaceholder = 'Search anything...',
  initials,
  onNotificationsClick,
  onAccountClick,
}: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.search}>
        <Icon name="search" className={styles.searchIcon} />
        <input type="text" placeholder={searchPlaceholder} aria-label="Search" />
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Notifications"
          onClick={onNotificationsClick}
        >
          <Icon name="bell" />
        </button>
        <button
          type="button"
          className={styles.avatar}
          aria-label="Account"
          onClick={onAccountClick}
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
