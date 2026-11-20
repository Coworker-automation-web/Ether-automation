import { Button } from './Button';
import { Icon } from './Icon';
import styles from './TeamsSection.module.css';

type TeamsSectionProps = {
  eyebrow: string;
  /** Title lines, separated by <br>. */
  titleLines: string[];
  description: string;
  ctaLabel: string;
  /** In-page anchor for the call to action. */
  ctaHref: string;
};

export function TeamsSection({
  eyebrow,
  titleLines,
  description,
  ctaLabel,
  ctaHref,
}: TeamsSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.planetContainer} aria-hidden="true">
        <Icon name="sparkle" className={styles.sparkle} />
        <div className={styles.planetDome} />
        <div className={styles.planetRing} />
      </div>

      <div className={styles.eyebrowRow}>
        <div className={styles.eyebrowLine} />
        <span className={styles.eyebrowText}>{eyebrow}</span>
        <div className={styles.eyebrowLine} />
      </div>

      <h2 className={styles.title}>
        {titleLines.map((line, i) => (
          <span key={line}>
            {i > 0 ? <br /> : null}
            {line}
          </span>
        ))}
      </h2>
      <p className={styles.desc}>{description}</p>

      <Button variant="outline" href={ctaHref} icon="arrow-right">
        {ctaLabel}
      </Button>
    </section>
  );
}
