export interface GroupModule {
  default: string[];
  label?: string;
}

export interface Example {
  group: string;
  slug: string;
  label: string;
  file?: string;
}

export interface Group {
  slug: string;
  label: string;
  items: Example[];
}

const titleCase = (s: string) =>
  s.split(/[-/]/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

function structure(order: string[], groups: Record<string, GroupModule>): Group[] {
  return order.filter((g) => groups[g]).map((g) => ({
    slug: g,
    label: groups[g].label ?? titleCase(g),
    items: groups[g].default.map((slug) => ({ group: g, slug, label: titleCase(slug) }))
  }));
}

export default structure;