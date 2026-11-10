import { Component } from "@expressive/mvc";
import { Link } from "@expressive/dev";

import { style } from "../style";

type Level = "h1" | "h2" | "h3" | "h4";

interface HeadingProps {
  id?: string;
  children?: Component.Node;
}

function heading(Tag: Level) {
  function Heading({ id, children }: HeadingProps) {
    return (
      <Tag id={id} _heading>
        {children}
        {id && <a href={`#${id}`} aria-label="Link to this section" _anchor>#</a>}
      </Tag>
    );
  }

  style(Heading, {
    _heading: { scrollMarginTop: 16, ":hover": { _anchor: { opacity: 1 } } },
    _anchor: { marginInlineStart: 8, opacity: 0, color: "inherit", textDecoration: "none" },
  });

  return Heading;
}

export const H1 = heading("h1");
export const H2 = heading("h2");
export const H3 = heading("h3");
export const H4 = heading("h4");

interface AnchorProps {
  href?: string;
  children?: Component.Node;
}

export function Anchor({ href = "", children }: AnchorProps) {
  const internal = href.startsWith("/") && !href.startsWith("//");

  if (internal)
    return <Link to={href}>{children}</Link>;

  const external = /^[a-z]+:/i.test(href);

  return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{children}</a>;
}

style(Anchor);

export function Cards({ children }: { children?: Component.Node }) {
  return <div _cards>{children}</div>;
}

style(Cards, {
  _cards: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, margin: [16, 0] },
});

interface CardProps {
  title: string;
  href: string;
  description?: string;
}

export function Card({ title, href, description }: CardProps) {
  return (
    <Link to={href} _card>
      <strong>{title}</strong>
      {description && <span _description>{description}</span>}
    </Link>
  );
}

style(Card, {
  _card: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: [12, 14],
    border: "1px solid #e3e3e8",
    borderRadius: 8,
    color: "inherit",
    ":hover": { borderColor: "#3a5bd9" },
  },
  _description: { fontSize: "0.9rem", color: "#6e6e73" },
});

export class Compare extends Component {
  labels: string[] = [];
  active = 0;

  render() {
    const { labels, active, props: { children }, is } = this;
    const panels = [children].flat().filter(child => child && typeof child == "object");

    return (
      <div _compare>
        <div role="tablist" _tabs>
          {labels.map((label, index) => (
            <button key={label} role="tab" aria-selected={index === active} _tab _selected={index === active} onClick={() => (is.active = index)}>
              {label}
            </button>
          ))}
        </div>
        {panels[active]}
      </div>
    );
  }
}

style(Compare, {
  _compare: { margin: [16, 0] },
  _tabs: { row: 4, marginBottom: -8 },
  _tab: { font: "inherit", fontSize: "0.85rem", padding: [4, 10], border: "1px solid #e3e3e8", borderRadius: 6, background: "white", cursor: "pointer" },
  _selected: { borderColor: "#3a5bd9", color: "#3a5bd9" },
});

export class Tabs extends Component {
  items: string[] = [];
  active = "";

  render() {
    const { items, active, props: { children }, is } = this;
    const current = active || items[0];

    return (
      <div _tabs>
        <div role="tablist" _bar>
          {items.map(item => (
            <button key={item} role="tab" aria-selected={item === current} _tab _selected={item === current} onClick={() => (is.active = item)}>
              {item}
            </button>
          ))}
        </div>
        {children}
      </div>
    );
  }
}

style(Tabs, {
  _bar: { row: 4 },
  _tab: { font: "inherit", padding: [4, 10], border: "1px solid #e3e3e8", borderRadius: 6, background: "white", cursor: "pointer" },
  _selected: { borderColor: "#3a5bd9" },
});

export function Tab({ value, children }: { value: string; children?: Component.Node }) {
  const { items, active } = Tabs.get();
  const shown = (active || items[0]) === value;

  return shown ? <div role="tabpanel">{children}</div> : null;
}

style(Tab);

export function Playground({ of, height = 480 }: { of: string; height?: number }) {
  return (
    <div style={{ height: `${height}px` }} data-playground={of} _playground>
      Playground: {of}
    </div>
  );
}

style(Playground, {
  _playground: { display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #c7c7cc", borderRadius: 8, color: "#6e6e73", margin: [16, 0] },
});
