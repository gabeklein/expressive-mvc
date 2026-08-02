import { existsSync, mkdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PACKAGES = ['mvc', 'react', 'router'];

/**
 * Guarantee the `@expressive` scope under node_modules so bare specifiers
 * resolve the way a consumer's do. The runner's `bun install --frozen-lockfile`
 * does not always leave these behind, and nothing else in CI notices because
 * vitest maps the scope onto package sources with its own aliases.
 *
 * @returns Disposer which removes only the links this call created.
 */
export function withWorkspaceLinks() {
  const scope = join('node_modules', '@expressive');
  const created: string[] = [];

  mkdirSync(scope, { recursive: true });

  for (const name of PACKAGES) {
    const link = join(scope, name);

    if (!existsSync(link)) {
      symlinkSync(resolve('packages', name), link, 'junction');
      created.push(link);
    }
  }

  if (created.length)
    console.log(`Linked for measurement: ${created.join(', ')}\n`);

  return () => {
    for (const link of created) unlinkSync(link);
  };
}
