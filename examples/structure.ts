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

const titleCase = (s: string) =>
  s.split(/[-/]/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/**
 * Build an ordered tree from manifests keyed by directory path (root = '').
 * A directory is a branch when it has a manifest, otherwise a leaf.
 */
export default function structure(manifests: Record<string, GroupModule>): Directory[] {
  const build = (dir: string): Directory[] =>
    (manifests[dir]?.default ?? []).map((slug) => {
      const path = dir ? `${dir}/${slug}` : slug;
      const entry: Directory = { slug, label: manifests[path]?.label ?? titleCase(slug), path };

      if (manifests[path]) entry.children = build(path);

      return entry;
    });

  return build('');
}

export const leaves = (dirs: Directory[]): Directory[] =>
  dirs.flatMap((d) => (d.children ? leaves(d.children) : d));
