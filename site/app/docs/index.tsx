import { Component } from "@expressive/mvc";
import { Link } from "@expressive/dev";
import tree from "virtual:docs-tree";

import { Mdx } from "../../mdx";
import { style } from "../style";
import { Anchor, Card, Cards, Compare, H1, H2, H3, H4, Playground, Tab, Tabs } from "./components";
import type { Node } from "../../tree";
import { Pre, Search, ThemeToggle } from "./tools";

export default class Docs extends Mdx {
  h1 = H1;
  h2 = H2;
  h3 = H3;
  h4 = H4;
  a = Anchor;
  Cards = Cards;
  Card = Card;
  Compare = Compare;
  Tabs = Tabs;
  Tab = Tab;
  Playground = Playground;
  pre = Pre;
}

export function Layout({ children }: { children?: Component.Node }) {
  return (
    <div _frame>
      <nav _sidebar>
        <div _top>
          <Link to="/docs" _brand>Expressive</Link>
          <ThemeToggle />
        </div>
        <Search />
        <Tree nodes={tree} />
      </nav>
      <div _main>{children}</div>
    </div>
  );
}

style(Layout, $ => ({
  fontFamily: "system-ui, sans-serif",
  color: $.ink,
  _frame: { display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", minHeight: "100vh" },
  _sidebar: {
    position: "sticky",
    top: 0,
    height: "100vh",
    overflowY: "auto",
    padding: [20, 16],
    borderInlineEnd: ["1px", "solid", $.line],
    fontSize: "0.9rem",
  },
  _top: { row: 8, justifyContent: "space-between", marginBottom: 16 },
  _brand: { fontWeight: 700, color: $.ink, textDecoration: "none" },
  _main: { minWidth: 0 },
  $narrow: { _frame: { gridTemplateColumns: "1fr" }, _sidebar: { position: "static", height: "auto" } },
}));

function Tree({ nodes }: { nodes: Node[] }) {
  return (
    <ul _list>
      {nodes.map(node =>
        "path" in node ? (
          <li key={node.path}>
            <SideLink to={node.path}>{node.title}</SideLink>
          </li>
        ) : (
          <li key={node.title}>
            <span _section>{node.title}</span>
            <Tree nodes={node.pages} />
          </li>
        ),
      )}
    </ul>
  );
}

style(Tree, $ => ({
  _list: { listStyle: "none", margin: 0, padding: 0, _ul: { paddingInlineStart: 0 } },
  _section: { display: "block", marginTop: 14, marginBottom: 4, fontWeight: 600, color: $.muted, fontSize: "0.8rem", textTransform: "uppercase" },
}));

class SideLink extends Link {
  render({ children }: Link.Props = {}) {
    const { href, match, go } = this;

    return <a href={href} onClick={go} aria-current={match === true ? "page" : undefined} _item _current={match === true}>{children}</a>;
  }
}

style(SideLink, $ => ({
  _item: { display: "block", padding: [3, 8], borderRadius: 6, color: $.ink, textDecoration: "none", ":hover": { background: $.code } },
  _current: { color: $.accent, background: $.code, fontWeight: 600 },
}));

export function Loading() {
  return <p>Loading…</p>;
}

style(Loading);
