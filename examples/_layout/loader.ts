export interface Example {
  order: number;
  slug: string;
  label: string;
  path: string;
  file: string;
}

export interface Group {
  order: number;
  slug: string;
  label: string;
  items: Example[];
}

export function organize(modules: Record<string, unknown>): Group[] {
  const groups = new Map<string, Group>();

  for (const file of Object.keys(modules)) {
    const [g, l] = file.split('/').slice(1, -1);
    let group = groups.get(g);

    if (!group)
      groups.set(
        g,
        (group = {
          order: order(g),
          slug: slug(g),
          label: titleCase(slug(g)),
          items: []
        })
      );

    group.items.push({
      order: order(l),
      slug: slug(l) + '/*',
      label: titleCase(slug(l)),
      path: `/${slug(g)}/${slug(l)}`,
      file
    });
  }

  return Array
    .from(groups.values())
    .sort(byOrder)
    .map((g) => ({
      ...g,
      items: g.items.sort(byOrder)
    }));
}

function order(seg: string) {
  return +(seg.match(/^(\d+)-/)?.[1] ?? 0);
}

function slug(seg: string) {
  return seg.replace(/^\d+-/, '');
}

function byOrder<T extends { order: number }>(a: T, b: T) {
  return a.order - b.order;
}

function titleCase(str: string) {
  return str
    .split(' ')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
