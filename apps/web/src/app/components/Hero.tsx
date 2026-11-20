import { Badge } from './Badge';
import { Button } from './Button';
import { HeroVisual } from './HeroVisual';
import { Icon } from './Icon';
import styles from './Hero.module.css';

type HeroProps = {
  badgeLabel: string;
  /** Heading lines before the emphasised word; joined with <br>. */
  headingLines: string[];
  /** Italic closing word(s) of the heading. */
  headingEmphasis: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  /** In-page anchor for the secondary "learn more" link. */
  secondaryLabel: string;
  secondaryHref: string;
  avatars: [string, string, string];
};

export function Hero({
  badgeLabel,
  headingLines,
  headingEmphasis,
  description,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  avatars,
}: HeroProps) {
  return (
    <section className={styles.block}>
      <div className={styles.left}>
        <Badge tone="orange" label={badgeLabel} />

        <h1 className={styles.heading}>
          {headingLines.map((line, i) => (
            <span key={line}>
              {i > 0 ? <br /> : null}
              {line}
            </span>
          ))}{' '}
          <em>{headingEmphasis}</em>
        </h1>

        <p className={styles.desc}>{description}</p>

        <div className={styles.ctaRow}>
          <Button variant="primary" href={primaryHref} icon="arrow-right">
            {primaryLabel}
          </Button>
          <a href={secondaryHref} className={styles.learnMore}>
            <div className={styles.playCircle}>
              <Icon name="play-fill" />
            </div>
            <span>{secondaryLabel}</span>
          </a>
        </div>
      </div>

      <HeroVisual avatars={avatars} />
    </section>
  );
}
