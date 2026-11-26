// The only script on the landing page: smooth in-page scrolling for "Learn More" and
// "Explore Features". Both are real #anchor links, so they still work without JavaScript.
//
// The scroll helper is loaded on first click via a dynamic import. Astro inlines any script that
// has no imports into the HTML; this import keeps the entry an external file so a strict
// Content-Security-Policy can forbid inline scripts.
document.querySelectorAll<HTMLElement>('[data-scroll-to]').forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    const selector = trigger.dataset.scrollTo;
    const target = selector ? document.querySelector(selector) : null;
    if (!selector || !target) return;
    event.preventDefault();
    import('./_scroll-to')
      .then((m) => m.scrollToTarget(target))
      .catch(() => {
        window.location.hash = selector;
      });
  });
});
