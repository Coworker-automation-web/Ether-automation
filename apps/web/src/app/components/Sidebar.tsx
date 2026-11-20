import { Icon, type IconName } from './Icon';
import styles from './Sidebar.module.css';

export type SidebarNavItem = {
  label: string;
  href: string;
  icon: IconName;
  /** Marks the current page (rendered as aria-current="page"). */
  current?: boolean;
  /** Optional click handler, e.g. to open a dialog instead of navigating. */
  onClick?: () => void;
};

export type SidebarFooter = {
  /** Title lines, separated by <br>. */
  titleLines: string[];
  /** Show a star above the title (landing variant). */
  markAbove?: boolean;
  /** Small caption with a star, below the title (workspace variant). */
  caption?: string;
};

type SidebarProps = {
  homeHref: string;
  items: SidebarNavItem[];
  footer: SidebarFooter;
};

export function Sidebar({ homeHref, items, footer }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <a href={homeHref} className={styles.logo}>
        <Icon name="sparkle" className={styles.logoStar} />
        <span className={styles.logoText}>Ether</span>
      </a>

      <nav className={styles.nav} aria-label="Primary">
        {items.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={styles.navLink}
            aria-current={item.current ? 'page' : undefined}
            onClick={item.onClick}
          >
            <Icon name={item.icon} className={styles.navIcon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      <div className={styles.footerCard}>
        <svg
          className={styles.footerWaves}
          viewBox="0 0 140 80"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path d="M-10 60 C30 30, 80 75, 150 40 L150 90 L-10 90 Z" fill="#E2D6C6" />
          <path d="M-10 40 C40 60, 90 25, 150 55 L150 90 L-10 90 Z" fill="#D8CABE" />
          <path d="M-10 20 C50 45, 100 15, 150 35 L150 90 L-10 90 Z" fill="#CEBFB1" />
        </svg>
        <div className={styles.footerContent}>
          <div className={styles.footerTitle}>
            {footer.markAbove ? (
              <>
                <Icon name="sparkle" className={styles.footerMark} />
                <br />
              </>
            ) : null}
            {footer.titleLines.map((line, i) => (
              <span key={line}>
                {i > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </div>
          {footer.caption ? (
            <div className={styles.footerSub}>
              <Icon name="sparkle" />
              <span>{footer.caption}</span>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
