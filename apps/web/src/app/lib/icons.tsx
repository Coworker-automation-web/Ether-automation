import type { ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "viewBox">;

/** Stroke icon exactly as the prototype draws it (24px grid, 2px round stroke). Decorative by default. */
function Stroke({ children, strokeWidth = 2, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

function Solid({ children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const StarIcon = (p: IconProps) => (
  <Solid {...p}>
    <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
  </Solid>
);

export const PlayIcon = (p: IconProps) => (
  <Stroke {...p}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </Stroke>
);

export const PlaySolidIcon = (p: IconProps) => (
  <Solid {...p}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </Solid>
);

export const PenIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </Stroke>
);

export const ImageIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </Stroke>
);

export const BlueprintIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </Stroke>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="m6 9 6 6 6-6" />
  </Stroke>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="m9 18 6-6-6-6" />
  </Stroke>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </Stroke>
);

export const PlusIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M5 12h14M12 5v14" />
  </Stroke>
);

export const BoltIcon = (p: IconProps) => (
  <Stroke strokeWidth={2.5} {...p}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </Stroke>
);

export const AgentStarIcon = (p: IconProps) => (
  <Stroke {...p}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Stroke>
);

export const GlobeIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" x2="22" y1="12" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </Stroke>
);

export const CloseIcon = (p: IconProps) => (
  <Stroke strokeWidth={2.5} {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Stroke>
);

export const ListIcon = (p: IconProps) => (
  <Stroke {...p}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </Stroke>
);

export const FileIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </Stroke>
);

export const SettingsIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Stroke>
);
