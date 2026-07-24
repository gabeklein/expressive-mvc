export interface GroupModule {
  default: string[];
  label?: string;
}

export interface Directory {
  slug: string;
  label: string;
  path: string;
  children?: Directory[];
  file?: string;
}

/**
 * Build an ordered tree from manifests keyed by directory path (root = '').
 * A directory is a branch when it has a manifest, otherwise a leaf.
 *
 * Keys may carry a `baseUrl` prefix and an `index.ts` suffix (as produced by
 * import.meta.glob); both are stripped so callers can pass glob results directly.
 * When `modules` is given, each leaf whose `<baseUrl><path>/App.tsx` exists there
 * has that key attached as `file` (its lazy module key doubles as the iframe src).
 */
export default function structure(
  raw: Record<string, GroupModule>,
  baseUrl = '',
  modules: Record<string, unknown> = {}
): Directory[] {
  const manifests: Record<string, GroupModule> = {};

  for (const key in raw)
    manifests[strip(key, baseUrl)] = raw[key];

  const build = (dir: string): Directory[] =>
    (manifests[dir]?.default ?? []).map((slug): Directory => {
      const path = dir ? `${dir}/${slug}` : slug;
      const label = manifests[path]?.label ?? titleCase(slug);
      const children = manifests[path] && build(path);

      const node: Directory = { slug, label, path, children };

      if (!children) {
        const file = `${baseUrl}${path}/App.tsx`;
        if (file in modules) node.file = file;
      }

      return node;
    });

  return build('');
}

export const leaves = (dirs: Directory[]): Directory[] =>
  dirs.flatMap((d) => (d.children ? leaves(d.children) : d));

const titleCase = (s: string) =>
  s.split(/[-/]/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

const strip = (key: string, prefix: string) =>
  (key.startsWith(prefix) ? key.slice(prefix.length) : key)
    .replace(/\/?index\.ts$/, '');
