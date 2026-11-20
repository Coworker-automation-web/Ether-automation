import { Button } from './Button';
import { Icon } from './Icon';
import { WorkspaceMockup } from './WorkspaceMockup';
import styles from './CreateWorkspace.module.css';

type CreateWorkspaceProps = {
  id: string;
  tagLabel: string;
  /** Title lines, separated by <br>. */
  titleLines: string[];
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

export function CreateWorkspace({
  id,
  tagLabel,
  titleLines,
  description,
  ctaLabel,
  ctaHref,
}: CreateWorkspaceProps) {
  return (
    <section className={styles.card} id={id}>
      <div className={styles.left}>
        <div className={styles.tag}>
          <Icon name="square-x" />
          <span>{tagLabel}</span>
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

        <Button variant="primary" href={ctaHref} icon="plus" iconPosition="before" iconStrokeWidth={2.5}>
          {ctaLabel}
        </Button>
      </div>

      <WorkspaceMockup />
    </section>
  );
}
