import type { ReactNode } from 'react';
import type { RenderOptions } from '@testing-library/react';
import { afterEach } from 'vitest';
import { injectIntoGlobalHook } from 'react-refresh/runtime';

import '../mvc/test.setup';

if (!('__REACT_DEVTOOLS_GLOBAL_HOOK__' in window)) injectIntoGlobalHook(window);

const { cleanup, render } = await import('@testing-library/react');
const { createElement, startTransition, useLayoutEffect, useRef, useState } = await import('react');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

/**
 * Mounts content in a transition, recording the text of each `selector` match per commit.
 * `slow()` blocks a render for ~1ms so React yields, and schedules `write` on first call.
 */
export function revisions(write: () => void, selector = 'span') {
  const commits: (string | null)[][] = [];
  let scheduled = false;

  function slow() {
    const started = performance.now();

    while (performance.now() - started < 1) {}

    if (!scheduled) {
      scheduled = true;
      setTimeout(write);
    }
  }

  function reveal(content: ReactNode, options?: RenderOptions) {
    let show!: () => void;

    function Recorder() {
      const root = useRef<HTMLDivElement>(null);

      useLayoutEffect(() => {
        commits.push([...root.current!.querySelectorAll(selector)].map((node) => node.textContent));
      });

      return createElement('div', { ref: root }, content);
    }

    function App() {
      const [shown, setShown] = useState(false);
      show = () => startTransition(() => setShown(true));
      return shown && createElement(Recorder);
    }

    const view = render(createElement(App), options);

    show();

    return view;
  }

  return { commits, slow, reveal };
}

export { mockError, mockPromise, mockWarn, flushMicrotasks } from '../mvc/test.setup';
