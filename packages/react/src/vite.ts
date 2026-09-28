import { dirname } from 'node:path';
import type { Plugin } from 'vite';
import { hot } from '@expressive/mvc/runtime';

const SOURCE = /\.[cm]?[jt]sx?$/;

/** Hot-patch State and Component classes in place during `vite` dev. */
export default function expressive(): Plugin {
  let runtime: Promise<string | null | undefined> | undefined;

  return {
    name: '@expressive/react:hot',
    apply: 'serve',
    enforce: 'post',
    async transform(code, id) {
      const [file] = id.split('?');

      if (!SOURCE.test(file) || file.includes('/node_modules/') || !code.includes('class'))
        return;

      runtime ||= this.resolve('@expressive/mvc/runtime').then((found) => found && dirname(found.id));

      const own = await runtime;

      if (own && file.startsWith(own)) return;

      const output = hot.inject(file, this.parse(code));

      if (output) return { code: code + output, map: null };
    }
  };
}
