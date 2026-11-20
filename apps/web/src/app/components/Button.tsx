import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './Button.module.css';

type ButtonProps = {
  variant: 'primary' | 'outline';
  children: ReactNode;
  /** Renders a link when set, a <button> otherwise. */
  href?: string;
  icon?: IconName;
  iconPosition?: 'before' | 'after';
  iconStrokeWidth?: number;
  /** Toggled/selected look (outline variant). Also exposed as aria-pressed on buttons. */
  active?: boolean;
  /** Dims the button and spins its icon; the button ignores pointer input. */
  loading?: boolean;
  onClick?: () => void;
};

export function Button({
  variant,
  children,
  href,
  icon,
  iconPosition = 'after',
  iconStrokeWidth,
  active,
  loading,
  onClick,
}: ButtonProps) {
  const className = [
    styles[variant],
    active ? styles.active : '',
    loading ? styles.loading : '',
  ]
    .filter(Boolean)
    .join(' ');

  const iconEl = icon ? <Icon name={icon} strokeWidth={iconStrokeWidth} /> : null;
  const content = (
    <>
      {iconPosition === 'before' ? iconEl : null}
      <span>{children}</span>
      {iconPosition === 'after' ? iconEl : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={className}
      aria-pressed={active}
      aria-busy={loading || undefined}
      disabled={loading}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
