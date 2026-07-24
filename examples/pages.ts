import type { ComponentType } from 'react';

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

const BASE = './pages/';

const manifests = import.meta.glob<GroupModule>('./pages/**/index.ts', { eager: true });
const apps = import.meta.glob<{ default: ComponentType }>('./pages/*/**/App.tsx');

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

  const build = (dir: string): Directory[] =>
    (dirs[dir]?.default ?? []).map((slug): Directory => {
      const path = dir ? `${dir}/${slug}` : slug;
      const label = dirs[path]?.label ?? titleCase(slug);
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

  return build('');
})();

const leaves = (dirs: Directory[]): Directory[] =>
  dirs.flatMap((d) => (d.children ? leaves(d.children) : d));

export const home = leaves(tree)[0]?.path;

export const frameSrc = (file: string) => `module#${encodeURIComponent(file)}`;

export const loadFrame = () => apps[decodeURIComponent(location.hash.slice(1))];
