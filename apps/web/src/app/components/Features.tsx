import { FeatureCard, type FeatureCardProps } from './FeatureCard';
import styles from './Features.module.css';

type FeaturesProps = {
  id: string;
  items: FeatureCardProps[];
};

export function Features({ id, items }: FeaturesProps) {
  return (
    <section className={styles.grid} id={id}>
      {items.map((item) => (
        <FeatureCard key={item.titleLines.join(' ')} {...item} />
      ))}
    </section>
  );
}
