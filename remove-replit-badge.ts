/**
 * Removes the Replit "Made in Replit" badge that gets injected at runtime
 * when the app is hosted on Replit's servers.
 * This runs once on app startup and also observes for late injection.
 */
export function removeReplitBadge() {
  const SELECTORS = [
    '#replit-badge',
    '[id^="replit-badge"]',
    '[class*="replit-badge"]',
    '[class*="replitBadge"]',
    '#replBadge',
    '[data-cy="replit-badge"]',
  ];

  function removeBadge() {
    SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Also block any script tags pointing to Replit badge CDN
    document.querySelectorAll('script[src*="replit.com"]').forEach(el => {
      if ((el as HTMLScriptElement).src.includes('badge')) {
        el.remove();
      }
    });
  }

  // Remove immediately
  removeBadge();

  // Observe for late injection (Replit injects after page load)
  const observer = new MutationObserver(() => removeBadge());
  observer.observe(document.body, { childList: true, subtree: true });

  return () => observer.disconnect();
}
