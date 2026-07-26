import type { ComponentType } from 'react';

export interface GroupModule {
  default: string[] | Record<string, string>;
  label?: string;
}

export interface Directory {
  slug: string;
  label: string;
  path: string;
  children?: Directory[];
  file?: string;
}

export interface Source {
  name: string;
  code: string;
  lang: 'tsx' | 'ts' | 'css';
}

const BASE = './pages/';

const manifests = import.meta.glob<GroupModule>('./pages/**/index.ts', { eager: true });
const apps = import.meta.glob<{ default: ComponentType }>('./pages/*/**/App.tsx');

// Raw source of every example file, eager so the code viewer reads strings
// directly and Vite hot-updates them when the real files change on disk.
const sources = import.meta.glob('./pages/**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

const titleCase = (s: string) =>
  s.split(/[-/]/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

const strip = (key: string) =>
  (key.startsWith(BASE) ? key.slice(BASE.length) : key).replace(/\/?index\.ts$/, '');

/**
 * Ordered tree of examples, keyed off directory manifests (root = '').
 * A directory is a branch when it has a manifest, otherwise a leaf; each leaf's
 * lazy App.tsx module key is attached as `file` (it doubles as the iframe src).
 */
export const tree = (() => {
  const dirs: Record<string, GroupModule> = {};

  for (const key in manifests)
    dirs[strip(key)] = manifests[key];

  const build = (dir: string): Directory[] => {
    const manifest = dirs[dir]?.default ?? [];
    const entries = Array.isArray(manifest)
      ? manifest.map((slug) => [slug, undefined] as [string, string?])
      : Object.entries(manifest);

    return entries.map(([slug, name]): Directory => {
      const path = dir ? `${dir}/${slug}` : slug;
      const label = name ?? dirs[path]?.label ?? titleCase(slug);
      const children = dirs[path] && build(path);
      const file = `${BASE}${path}/App.tsx`;

      return {
        slug,
        label,
        path,
        children,
        file: !children && file in apps ? file : undefined,
      };
    });
  };

  return build('');
})();

const leaves = (dirs: Directory[]): Directory[] =>
  dirs.flatMap((d) => (d.children ? leaves(d.children) : d));

export const home = leaves(tree)[0]?.path;

export const frameSrc = (file: string) => `module#${encodeURIComponent(file)}`;

export const loadFrame = () => apps[decodeURIComponent(location.hash.slice(1))];

const sortKey = (name: string) =>
  (name === 'App.tsx' ? '0' : name === 'App.css' ? '1' : '2') + name;

/** Source files that live directly in an example's directory, App-first. */
export const filesFor = (path: string): Source[] => {
  const dir = `${BASE}${path}/`;

  return Object.keys(sources)
    .filter((key) => key.startsWith(dir) && !key.slice(dir.length).includes('/'))
    .map((key) => key.slice(dir.length))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    .map((name) => ({
      name,
      code: sources[dir + name],
      lang: name.endsWith('.css') ? 'css' : name.endsWith('.tsx') ? 'tsx' : 'ts'
    }));
};
