/**
 * Global MozBook Section Auto-Scroll Utility
 *
 * Provides smooth, reliable viewport navigation to on-page sections across desktop
 * and mobile layouts, accounting for sticky navbars and asynchronous React rendering.
 */

export interface ScrollToSectionOptions {
  /** Target section ID or element selector (e.g. 'travel-documents-minors-section' or '#visa-checker') */
  target: string | HTMLElement | null;
  /** Sticky header height offset in px (default: 88px) */
  offset?: number;
  /** Smooth or instant scroll (default: 'smooth') */
  behavior?: ScrollBehavior;
  /** Max attempts to wait for conditionally rendered / async content (default: 12) */
  maxRetries?: number;
  /** Milliseconds between retries (default: 50) */
  retryInterval?: number;
  /** If element is already nicely visible in viewport, avoid unnecessary scroll (default: true) */
  onlyIfNotVisible?: boolean;
  /** Optional callback once scroll is completed */
  onComplete?: () => void;
}

const DEFAULT_HEADER_OFFSET = 88; // Accounts for MozBook sticky Navbar (64-80px) + padding

/**
 * Checks whether an element's top edge is already comfortably in view
 */
export function isElementInViewport(el: HTMLElement, offset = DEFAULT_HEADER_OFFSET): boolean {
  const rect = el.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;

  // If top of element is below the sticky header and within the upper 60% of the viewport
  return rect.top >= offset - 10 && rect.top <= windowHeight * 0.6;
}

/**
 * Scrolls smoothly to a target section on the current page
 */
export function scrollToSection(options: ScrollToSectionOptions): boolean {
  const {
    target,
    offset = DEFAULT_HEADER_OFFSET,
    behavior = 'smooth',
    maxRetries = 12,
    retryInterval = 50,
    onlyIfNotVisible = true,
    onComplete
  } = options;

  if (!target) return false;

  let element: HTMLElement | null = null;

  if (typeof target === 'string') {
    const cleanId = target.startsWith('#') ? target.slice(1) : target;
    element = document.getElementById(cleanId);
    if (!element) {
      try {
        element = document.querySelector<HTMLElement>(target);
      } catch {
        // invalid selector
      }
    }
  } else if (target instanceof HTMLElement) {
    element = target;
  }

  // If element is not yet found in DOM (e.g. React state rendering or async data loading)
  if (!element) {
    if (maxRetries > 0) {
      setTimeout(() => {
        scrollToSection({
          ...options,
          maxRetries: maxRetries - 1
        });
      }, retryInterval);
    }
    return false;
  }

  // Check if target is already visible
  if (onlyIfNotVisible && isElementInViewport(element, offset)) {
    if (onComplete) onComplete();
    return true;
  }

  // Calculate target vertical position relative to document
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const targetTop = Math.max(0, rect.top + scrollTop - offset);

  // Perform scroll
  window.scrollTo({
    top: targetTop,
    behavior
  });

  if (onComplete) {
    setTimeout(onComplete, 400);
  }

  return true;
}

/**
 * Handle URL hash navigation on page load or hash change
 */
export function scrollToHashTarget(hash = window.location.hash, offset = DEFAULT_HEADER_OFFSET): boolean {
  if (!hash || hash === '#' || hash === '#!') return false;
  return scrollToSection({
    target: hash,
    offset,
    behavior: 'smooth',
    maxRetries: 15,
    retryInterval: 60,
    onlyIfNotVisible: true
  });
}
