export const ICON_NAMES = [
  'home', 'grid', 'folder', 'agents', 'templates', 'tag', 'settings', 'search', 'bell',
  'arrow-right', 'chevron-down', 'chevron-right', 'clock', 'file-text', 'pen', 'image',
  'play', 'star', 'globe', 'list', 'close', 'plus', 'zap', 'box', 'shield-check', 'users',
  'square-x', 'sparkle', 'play-fill', 'cursor',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

type IconProps = {
  name: IconName;
  /** Optional intrinsic size in px; CSS on `className` (or a parent rule) overrides it. */
  size?: number;
  /** Stroke width for outline icons (solid icons ignore it). */
  strokeWidth?: number;
  className?: string;
  /** Accessible name. Omit for decorative icons (the default), which are hidden from AT. */
  title?: string;
};

const SPRITE = '/icons.svg';

export function Icon({ name, size, strokeWidth = 2, className, title }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <use href={`${SPRITE}#${name}`} />
    </svg>
  );
}
