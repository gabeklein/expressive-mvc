import { Component } from '@expressive/mvc';

import { ComponentChildren } from 'preact';
import { Component as PreactComponent } from 'preact/compat';

export class ErrorBoundary extends PreactComponent<{
  self: Component;
  children: ComponentChildren;
}> {
  state = {} as { error?: Error };
  recovering = false;

  constructor(props: ErrorBoundary['props']) {
    super(props);
  }

  // Note: error state is assigned here rather than via a static
  // getDerivedStateFromError. Preact's catch-error walk would otherwise
  // remember the dirtiness caused by gDSFE and treat a throw from
  // componentDidCatch as handled at the next ancestor instead of
  // propagating it to the next boundary up.
  componentDidCatch(error: Error) {
    // A throw while still recovering means the previous catch did not fix
    // the problem - propagate. (React reaches the equivalent state through a
    // synchronous re-render throwing in `render` while `recovering` is set;
    // preact re-renders asynchronously, after `recovering` already cleared,
    // so the failed recovery must be detected here. Thrown errors from
    // componentDidCatch continue up the boundary chain in preact.)
    if (this.recovering) throw error;

    this.setState({ error });

    const { self } = this.props;
    const { fallback } = self;
    // Reset on a macrotask: preact schedules re-renders on microtasks, so a
    // catch which resolves while render still throws would otherwise starve
    // the event loop (React schedules work through its scheduler instead).
    const reset = (error?: Error) =>
      setTimeout(() => {
        this.recovering = true;
        this.setState({ error });
      });

    Promise.resolve(self.catch!(error))
      .then(() => reset(), reset)
      .finally(() => self.set({ fallback }, true));
  }

  componentDidUpdate() {
    this.recovering = false;
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.recovering) throw this.state.error;
    return this.props.self.fallback;
  }
};
