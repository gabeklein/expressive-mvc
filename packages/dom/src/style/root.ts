import { serialize } from './declarations';
import type { Declaration } from './declarations';

interface Root {
  declarations: Declaration;
  when: readonly string[];
}

interface Group {
  roots: readonly Root[];
  strong: boolean;
}

const groups = new Map<object, Group>();
const documents = new Set<Document>();
const elements = new WeakMap<Document, Map<object, HTMLStyleElement>>();

function rule(document: Document, strong: boolean, { declarations, when }: Root) {
  const states = when.filter((condition) => condition[0] == ':').map((state) => `:is(${state})`).join('');
  const selector = strong ? `:root${states}` : `:where(:root${states})`;

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
    document.head.prepend(element);
    known.set(key, element);
  }

  const { roots, strong } = groups.get(key)!;

  element.textContent = roots
    .filter((root) => Object.keys(root.declarations).length)
    .map((root) => rule(document, strong, root))
    .join('\n');
}

function setRoot(key: object, roots: readonly Root[], strong = false) {
  groups.set(key, { roots, strong });

  for (const document of documents) write(document, key);
}

function attachRoots(document: Document) {
  documents.add(document);

  for (const key of groups.keys()) write(document, key);
}

export { attachRoots, setRoot };
export type { Root };
