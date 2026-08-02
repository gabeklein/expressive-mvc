import { Component } from '@expressive/mvc';
import React from 'react';
import { Context } from './context';

interface Entry {
  committed?: boolean;
  context: Context;
  commit: () => void;
  remove: () => void;
};

/** In-flight render attempts by tree position, per ambient context.
 *  When one commits, older uncommitted attempts at its slot are provably dead. */
const SLOTS = new WeakMap<Context, Map<string, Set<Entry>>>();

/**
 * React's attempt lifecycle: fiber-keyed stacking so a superseded (uncommitted)
 * render attempt at a tree position is discarded when a later one commits.
 */
export function dedupe(on: Component, context: Context) {
  let slots = SLOTS.get(context.parent!);
  if (!slots) SLOTS.set(context.parent!, (slots = new Map()));

  // key/index path to root: stable across render attempts of this element
  let slot = '';
  for (let f = (on as any)._reactInternals; f; f = f.return)
    slot += (f.key ?? f.index) + '.';

  let list = slots.get(slot);
  if (!list) slots.set(slot, (list = new Set()));

  const entry: Entry = {
    context,
    commit() {
      entry.committed = true;

      for (const e of list) {
        if (e === entry) break;
        if (e.committed) continue;
        e.context.pop();
        list.delete(e);
      }
    },
    remove() {
      list.delete(entry);
    }
  };

  list.add(entry);
  return entry;
};

export class ErrorBoundary extends React.Component<{
  self: Component;
  children: React.ReactNode;
}> {
  state = {} as { error?: Error };
  recovering = false;

  constructor(props: ErrorBoundary['props']) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    const { self } = this.props;
    const { fallback } = self;
    const reset = (error?: Error) => {
      this.recovering = true;
      this.setState({ error });
    };

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
