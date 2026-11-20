import { Icon, type IconName } from './Icon';
import styles from './Badge.module.css';

type BadgeProps = {
  label: string;
  tone: 'orange' | 'green';
  /** Optional trailing icon. */
  icon?: IconName;
  iconStrokeWidth?: number;
};

export function Badge({ label, tone, icon, iconStrokeWidth }: BadgeProps) {
  return (
    <div className={styles.badge}>
      <span className={`${styles.dot} ${tone === 'orange' ? styles.dotOrange : styles.dotGreen}`} />
      <span>{label}</span>
      {icon ? <Icon name={icon} strokeWidth={iconStrokeWidth} className={styles.icon} /> : null}
    </div>
  );
}
