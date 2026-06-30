import { Component, set } from "@expressive/mvc";
import { Route } from "@expressive/router";
import { type ComponentType } from 'react';

import structure, { type GroupModule } from '../structure';

export type Modules = Record<string, () => Promise<{ default: ComponentType }>>;

const MANIFESTS = import.meta.glob<GroupModule>('../*/index.ts', { eager: true });

const ORDER = Object.values(
  import.meta.glob<string[]>('../index.ts', { eager: true, import: 'default' })
)[0];

const GROUPS = structure(ORDER, bySlug(MANIFESTS));

export default class Routes extends Route {
  modules = set<Modules>();
  outlet = set<Route['as']>();
  notFound = set<Route['as']>();

  protected get children(): Component.Node {
    const { notFound, outlet } = this;
    const files = byExample(this.modules);
    const first = GROUPS[0]?.items[0];

    return (
      <>
        {first && <Route redirect={`/${first.group}/${first.slug}`} />}
        {GROUPS.map((g) => (
          <Route key={g.slug} to={g.slug} label={g.label}>
            {g.items.map((e) => (
              <Route
                key={e.slug}
                to={`${e.slug}/*`}
                as={outlet}
                label={e.label}
                meta={{ ...e, file: files[`${e.group}/${e.slug}`] }}
              />
            ))}
          </Route>
        ))}
        {super.children}
        {notFound && <Route default as={notFound} />}
      </>
    );
  }
}

function bySlug(manifests: Record<string, GroupModule>) {
  const out: Record<string, GroupModule> = {};

  for (const [path, manifest] of Object.entries(manifests))
    out[path.split('/').at(-2)!] = manifest;

  return out;
}

function byExample(modules: Modules) {
  const out: Record<string, string> = {};

  for (const file of Object.keys(modules)) {
    const [group, slug] = file.split('/').slice(1, -1);
    out[`${group}/${slug}`] = file;
  }

  return out;
}
