import { Component, set } from "@expressive/mvc";
import { Route } from "@expressive/router";
import { type ComponentType } from 'react';

import { type Group } from '../structure';

export type Modules = Record<string, () => Promise<{ default: ComponentType }>>;

export default class Routes extends Route {
  modules = set<Modules>();
  groups = set<Group[]>();
  outlet = set<Route['as']>();
  notFound = set<Route['as']>();

  protected get children(): Component.Node {
    const { notFound, outlet, groups } = this;
    const files = byExample(this.modules);
    const first = groups[0]?.items[0];

    return (
      <>
        {first && <Route redirect={`/${first.group}/${first.slug}`} />}
        {groups.map((g) => (
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

function byExample(modules: Modules) {
  const out: Record<string, string> = {};

  for (const file of Object.keys(modules)) {
    const parts = file.split('/');
    out[`${parts.at(-3)}/${parts.at(-2)}`] = file;
  }

  return out;
}
