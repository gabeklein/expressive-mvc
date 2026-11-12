import { Component, set } from "@expressive/mvc";
import { Route } from "@expressive/dev";

import { style } from "../style";
import { H1 } from "./components";
import { docOf, slugs, type Entry, type Module } from "./content";

const views = new Map<string, () => Promise<{ default: () => Component.Node }>>();

function viewOf(slug: string) {
  let view = views.get(slug);

  if (!view)
    views.set(slug, view = () => docOf(slug)!.then(module => ({ default: () => <Doc module={module} /> })));

  return view;
}

export const paths = () => slugs().filter(slug => !/^api(\/|$)/.test(slug)).map(slug => `/docs/${slug}`.replace(/\/$/, ""));

export function Page() {
  const { base, match = {} } = Route.get();
  const slug = [...base.split("/").slice(2), match["*"]].filter(Boolean).join("/");

  if (!docOf(slug)) return <h1>Page not found</h1>;

  const View = viewOf(slug);

  return <View />;
}

style(Page);

class Doc extends Component {
  module = set<Module>();

  protected new() {
    this.get(() => {
      const { title } = this.module.frontmatter ?? {};
      const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));

      document.title = title ? `${title} - Expressive` : "Expressive";

      if (target) target.scrollIntoView();
      else scrollTo(0, 0);
    });
  }

  render() {
    const { default: Content, frontmatter: { title, description } = {}, toc } = this.module;

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
