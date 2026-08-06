import { owns } from '@expressive/mvc/runtime';

import { Runtime } from './runtime';

interface Driver {
  start(work: () => void): void;
  waiting: (() => void)[];
}

/**
 * Wraps a component's content to host its transition scheduler. Separate from
 * the component itself because React re-renders whoever holds the hook when
 * pending flips - were that the component, the re-render would rebuild this
 * content, which reads the already-written value and suspends, defeating the
 * deferral. Re-rendering here leaves `children` identical, so the subtree
 * bails out.
 */
export function Driver(props: { owner: object; children: unknown }) {
  const hook = Runtime.useTransition;

  if (hook) {
    const [pending, start] = hook();
    const ref = Runtime.useRef<Driver | null>(null);
    const driver = ref.current || (ref.current = { start, waiting: [] });

    driver.start = start;

    Runtime.useEffect(
      () =>
        owns(props.owner, (work) =>
          new Promise<void>((resolve) => {
            driver.waiting.push(resolve);
            driver.start(work);
          })
        ),
      []
    );

    Runtime.useEffect(() => {
      if (!pending) for (const resolve of driver.waiting.splice(0)) resolve();
    }, [pending]);
  }

  return props.children;
}
