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
 */
export default function structure(manifests: Record<string, GroupModule>): Directory[] {
  const build = (dir: string): Directory[] =>
    (manifests[dir]?.default ?? []).map((slug): Directory => {
      const path = dir ? `${dir}/${slug}` : slug;
      const label = manifests[path]?.label ?? titleCase(slug);
      const children = manifests[path] && build(path);

      return {
        slug, label, path, children
      }
    });

  return build('');
}

export const leaves = (dirs: Directory[]): Directory[] =>
  dirs.flatMap((d) => (d.children ? leaves(d.children) : d));

const titleCase = (s: string) =>
  s.split(/[-/]/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
