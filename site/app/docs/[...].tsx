import type { Component } from "@expressive/mvc";
import { Route } from "@expressive/dev";

import { style } from "../style";
import { H1 } from "./components";
import { docOf, type Entry, type Module } from "./content";

const views = new Map<string, () => Promise<{ default: () => Component.Node }>>();

function viewOf(slug: string) {
  let view = views.get(slug);

  if (!view)
    views.set(slug, view = () => docOf(slug)!.then(module => ({ default: () => <Doc module={module} /> })));

  return view;
}

export function Page() {
  const { match } = Route.get();
  const slug = match?.["*"] ?? "";

  if (!docOf(slug)) return <h1>Page not found</h1>;

  const View = viewOf(slug);

  return <View />;
}

style(Page);

function Doc({ module }: { module: Module }) {
  const { default: Content, frontmatter = {}, toc } = module;
  const { title, description } = frontmatter;

  if (title) document.title = `${title} - Expressive`;

  return (
    <div _page>
      <article>
        {title && <H1 id="top">{title}</H1>}
        {description && <p _lead>{description}</p>}
        <Content />
      </article>
      <aside _aside>
        <Toc entries={toc} />
      </aside>
    </div>
  );
}

style(Doc, $ => ({
  _page: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 220px", gap: 32, maxWidth: 1100, padding: [24, 32] },
  _lead: { fontSize: "1.1rem", color: $.muted, marginTop: -8 },
  _aside: { fontSize: "0.85rem" },
  $narrow: { _page: { gridTemplateColumns: "1fr" }, _aside: { display: "none" } },
}));

function Toc({ entries }: { entries: Entry[] }) {
  return (
    <nav aria-label="On this page" _toc>
      <strong _heading>On this page</strong>
      <ul _list>
        {entries.map(({ id, title, depth }) => (
          <li key={id} _deep={depth > 2}>
            <a href={`#${id}`}>{title}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

style(Toc, $ => ({
  _toc: { position: "sticky", top: 24 },
  _heading: { display: "block", marginBottom: 8 },
  _list: { listStyle: "none", padding: 0, margin: 0, lineHeight: 1.8, _a: { color: $.muted } },
  _deep: { paddingInlineStart: 12 },
}));
