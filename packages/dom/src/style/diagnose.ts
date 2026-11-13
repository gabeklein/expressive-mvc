import type { StyleScope } from './appearance';
import { SUBCOMPONENT } from './protocol';
import type { AppearanceContext } from './protocol';

interface Author {
  props?: Record<string, unknown>;
  type?: unknown;
}

let enabled = false;
const said = new Set<string>();

function develop() {
  enabled = true;
}

function unmatched(
  props: Record<string, unknown>,
  contexts: (AppearanceContext | undefined)[],
  author: Author | undefined,
  target?: object,
  tag?: string
) {
  if (!enabled) return;

  const known = new Set<string>();

  for (const context of contexts)
    for (const name of (context?.scope as StyleScope | undefined)?.local || []) known.add(name);

  for (const key of Object.keys(props)) {
    const name = key.slice(1);

    if (key[0] != '_' || key[1] == '_' || SUBCOMPONENT.test(key) || name == tag || known.has(name)) continue;
    if (author?.props && key in author.props || target && key in target) continue;

    const near = [...known].find((other) => distance(name, other) <= 2);
    const owner = typeof author?.type == 'function' ? author.type.name.replace(/^bound /, '') : undefined;
    const where = owner ? (contexts.some(Boolean) ? ` in ${owner}` : ` - ${owner} has no style()`) : '';
    const message = `"${key}" matches no rule${where}.${near ? ` Did you mean "_${near}"?` : ''}`;

    if (!said.has(message)) {
      said.add(message);
      console.warn(message);
    }
  }
}

function distance(left: string, right: string) {
  let row = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i++) {
    const next = [i];

    for (let j = 1; j <= right.length; j++)
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (left[i - 1] == right[j - 1] ? 0 : 1));

    row = next;
  }

  return row[right.length];
}

export { develop, unmatched };
