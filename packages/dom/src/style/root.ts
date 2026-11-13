import { serialize } from './declarations';
import type { Declaration } from './declarations';
import { isSink } from './protocol';
import type { Target } from './protocol';

interface Root {
  declarations: Declaration;
  when: readonly string[];
}

const groups = new Map<object, readonly Root[]>();
const documents = new Set<Document>();
const elements = new WeakMap<Document, Map<object, HTMLStyleElement>>();

function rule(target: Target, { declarations, when }: Root) {
  const states = when.filter((condition) => condition[0] == ':').map((state) => `:is(${state})`).join('');
  const selector = `:where(:root${states})`;

  return when
    .filter((condition) => condition[0] == '@')
    .reduceRight((css, condition) => `${condition}{${css}}`, `${selector}{${serialize(target, declarations)}}`);
}

function write(target: Target, key: object) {
  const css = groups.get(key)!
    .filter((root) => Object.keys(root.declarations).length)
    .map((root) => rule(target, root))
    .join('\n');

  if (isSink(target)) return target.root(key, css);

  let known = elements.get(target);
  if (!known) elements.set(target, (known = new Map()));

  let element = known.get(key);

  if (!element?.isConnected) {
    element = target.createElement('style');
    element.dataset.expressive = 'root';
    target.head.append(element);
    known.set(key, element);
  }

  element.textContent = css;
}

function setRoot(key: object, roots: readonly Root[]) {
  groups.set(key, roots);

  for (const document of documents) write(document, key);
}

function attachRoots(target: Target) {
  if (!isSink(target)) documents.add(target);

  for (const key of groups.keys()) write(target, key);
}

export { attachRoots, setRoot };
export type { Root };
