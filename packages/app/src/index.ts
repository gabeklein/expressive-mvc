import { Application, GridLayout } from '@nativescript/core';
import { install, render } from '@expressive/jsx';
import type { Node } from '@expressive/jsx/node/vnode';

import { native } from './host';
import './tags';

install(native);

let running = false;

function run(node: Node) {
  if (running) return;
  running = true;

  (globalThis as any).__onLiveSyncCore = () => {};

  Application.run({
    create() {
      const root = new GridLayout();
      render(node, root);
      return root;
    }
  });
}

export { macro, render, style, Fragment, Portal } from '@expressive/jsx';
export { native, run };
