import { Icon } from './Icon';
import styles from './WorkspaceMockup.module.css';

/** Decorative clay-style illustration of the workspace window. */
export function WorkspaceMockup() {
  return (
    <div className={styles.mockup} aria-hidden="true">
      <div className={styles.topDots}>
        <div className={styles.dot} />
        <div className={styles.dot} />
        <div className={styles.dot} />
      </div>

      <div className={styles.body}>
        <div className={styles.miniSidebar}>
          <div className={styles.barIcon} />
          <div className={styles.barIcon} />
          <div className={styles.barIcon} />
          <div className={styles.barIcon} />
        </div>

        <div className={styles.canvas}>
          <Icon name="sparkle" className={styles.canvasStar} />
          <Icon name="cursor" className={styles.cursorArrow} />
        </div>
      </div>

      <div className={styles.rays}>
        <div className={styles.ray} />
        <div className={styles.ray} />
        <div className={styles.ray} />
      </div>
    </div>
  );
}
