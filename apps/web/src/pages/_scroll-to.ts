/** Smooth-scrolls to `target`, or jumps when the visitor prefers reduced motion. */
export function scrollToTarget(target: Element): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
}
