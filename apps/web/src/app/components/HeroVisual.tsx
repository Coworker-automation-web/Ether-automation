import { Icon } from './Icon';
import styles from './HeroVisual.module.css';

type HeroVisualProps = {
  /** Three self-hosted avatar image URLs (top right, middle, bottom left). */
  avatars: [string, string, string];
};

const AVATAR_CLASSES = [styles.av1, styles.av2, styles.av3] as const;

export function HeroVisual({ avatars }: HeroVisualProps) {
  return (
    <div className={styles.visual} aria-hidden="true">
      {/* Curved golden orbit paths */}
      <svg className={styles.orbit} viewBox="0 0 440 340" fill="none">
        <path d="M 40 320 Q 240 220 380 40" stroke="#E6DACD" strokeWidth="1.2" strokeDasharray="3 3" />
        <path d="M 120 330 Q 300 180 420 120" stroke="#DFD1C2" strokeWidth="1" />
        <circle cx="210" cy="225" r="3" fill="#C4A78E" />
        <circle cx="340" cy="95" r="2.5" fill="#C4A78E" />
        <path
          d="M310 135 L313 145 L323 148 L313 151 L310 161 L307 151 L297 148 L307 145 Z"
          fill="#C4A78E"
          opacity="0.8"
        />
      </svg>

      <div className={styles.teamCard}>
        <Icon name="users" strokeWidth={1.8} />
      </div>

      {avatars.map((src, i) => (
        <img
          key={src}
          className={`${styles.avatar} ${AVATAR_CLASSES[i]}`}
          src={src}
          alt=""
          width={120}
          height={120}
          loading="lazy"
        />
      ))}

      <div className={styles.docCard}>
        <div className={`${styles.docLine} ${styles.w80}`} />
        <div className={`${styles.docLine} ${styles.w60}`} />
        <div className={`${styles.docLine} ${styles.w90}`} />
        <div className={styles.docThumb}>
          <svg
            className={styles.docThumbDunes}
            viewBox="0 0 140 60"
            preserveAspectRatio="none"
            fill="none"
          >
            <path d="M0 45 C40 25, 80 55, 140 30 L140 60 L0 60 Z" fill="#D3C3B1" />
            <path d="M0 30 C50 50, 90 20, 140 45 L140 60 L0 60 Z" fill="#C4B29E" />
          </svg>
        </div>
      </div>
    </div>
  );
}
