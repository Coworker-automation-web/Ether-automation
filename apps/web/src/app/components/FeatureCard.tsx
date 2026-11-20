import { Icon, type IconName } from './Icon';
import styles from './FeatureCard.module.css';

export type FeatureCardProps = {
  icon: IconName;
  /** Title lines, separated by <br>. */
  titleLines: string[];
  description: string;
};

export function FeatureCard({ icon, titleLines, description }: FeatureCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.iconBox}>
        <Icon name={icon} />
      </div>
      <h3 className={styles.title}>
        {titleLines.map((line, i) => (
          <span key={line}>
            {i > 0 ? <br /> : null}
            {line}
          </span>
        ))}
      </h3>
      <p className={styles.desc}>{description}</p>
    </div>
  );
}
