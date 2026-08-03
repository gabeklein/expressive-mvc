import { ref } from '@expressive/mvc';

import { Source } from './source';

/**
 * Binds a trailing element; calls `source.more()` while that element is within
 * `margin` of the scroll viewport.
 *
 * DOM-only (IntersectionObserver). LFCP did this with getBoundingClientRect on a
 * parent scroll listener plus a manual re-arm flag; the observer makes the
 * hysteresis the browser's problem.
 */
export function sentinel(source: Source<unknown>, margin = 200) {
  return ref<HTMLElement>((element) => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) source.more();
      },
      { rootMargin: `0px 0px ${margin}px 0px` }
    );

    observer.observe(element);

    return () => observer.disconnect();
  });
}
