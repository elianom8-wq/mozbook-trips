import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollToSection, scrollToHashTarget, ScrollToSectionOptions } from '../utils/sectionScroll';

/**
 * Reusable hook to manage auto-scrolling when on-page sections are selected
 * or when navigating via deep links / URL hashes.
 */
export function useSectionScroll(options?: {
  defaultHashTarget?: string;
  headerOffset?: number;
}) {
  const location = useLocation();
  const offset = options?.headerOffset;
  const defaultHashTarget = options?.defaultHashTarget;

  // Listen to location.hash changes (and page mount)
  useEffect(() => {
    if (location.hash) {
      // Small tick to let route component mount
      const timer = setTimeout(() => {
        scrollToHashTarget(location.hash, offset);
      }, 50);
      return () => clearTimeout(timer);
    } else if (defaultHashTarget) {
      const timer = setTimeout(() => {
        scrollToSection({ target: defaultHashTarget, offset });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, location.hash, defaultHashTarget, offset]);

  // Imperative scroll trigger when user selects a section, category or tab
  const navigateToSection = useCallback(
    (targetIdOrSelector: string, customOpts?: Partial<ScrollToSectionOptions>) => {
      // Ensure target is ready after React re-renders with new selected section state
      requestAnimationFrame(() => {
        scrollToSection({
          target: targetIdOrSelector,
          offset: offset || 88,
          ...customOpts
        });
      });
    },
    [offset]
  );

  return { navigateToSection };
}
