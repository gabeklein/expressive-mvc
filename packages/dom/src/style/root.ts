import { serialize } from './declarations';
import type { Declaration } from './declarations';

interface Root {
  declarations: Declaration;
  when: readonly string[];
}

const groups = new Map<object, readonly Root[]>();
const documents = new Set<Document>();
const elements = new WeakMap<Document, Map<object, HTMLStyleElement>>();

function rule(document: Document, { declarations, when }: Root) {
  const states = when.filter((condition) => condition[0] == ':').map((state) => `:is(${state})`).join('');
  const selector = `:where(:root${states})`;

  return when
    .filter((condition) => condition[0] == '@')
    .reduceRight((css, condition) => `${condition}{${css}}`, `${selector}{${serialize(document, declarations)}}`);
}

function write(document: Document, key: object) {
  let known = elements.get(document);
  if (!known) elements.set(document, (known = new Map()));

  let element = known.get(key);

  if (!element?.isConnected) {
    element = document.createElement('style');
    element.dataset.expressive = 'root';
    document.head.append(element);
    known.set(key, element);
  }

  element.textContent = groups.get(key)!
    .filter((root) => Object.keys(root.declarations).length)
    .map((root) => rule(document, root))
    .join('\n');
}

function setRoot(key: object, roots: readonly Root[]) {
  groups.set(key, roots);

  for (const document of documents) write(document, key);
}

function attachRoots(document: Document) {
  documents.add(document);

  for (const key of groups.keys()) write(document, key);
}

export { attachRoots, setRoot };
export type { Root };
