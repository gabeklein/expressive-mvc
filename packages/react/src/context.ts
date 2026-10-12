import { State, Context, Component } from '@expressive/mvc';
import { Runtime } from './runtime';

let shared: any;

/**
 * Lazily-created context carrying the active {@link Context} down the tree.
 * Lazy because the framework's `createContext` arrives via {@link Runtime},
 * which an adapter's entry populates at load - after this module evaluates.
 */
function Layers() {
  return shared || (shared = Runtime.createContext(Context.root));
}

/** Read the ambient {@link Context} from the nearest Layers provider. */
function useAmbient() {
  return Runtime.useContext(Layers());
}

/** Wrap `children` in a {@link Layers} provider carrying `context` down the tree. */
function createProvider(context: Context, children: any) {
  return Runtime.createElement(Layers().Provider, { value: context, children });
}

// Class components consume the active Context through the host's `contextType`
Object.defineProperty(Component, 'contextType', { configurable: true, get: Layers });

const _get = Context.get;

Context.get = (state?: State) => {
  if (!state)
    try {
      return useAmbient();
    } catch { }

  return _get(state);
};

export { Context, createProvider };
