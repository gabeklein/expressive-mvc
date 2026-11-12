import { Component } from "@expressive/mvc";
import { Link } from "@expressive/dev";
import tree from "virtual:docs-tree";

import { style } from "../style";
import type { Document, Node } from "../../tree";

interface Result {
  to: string;
  title: string;
  heading: string;
  text: string;
}

export class Search extends Component {
  open = false;
  query = "";
  documents: Document[] = [];

  protected new() {
    this.get(() => {
      const keydown = (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key == "k") {
          event.preventDefault();
          this.show();
        } else if (event.key == "Escape") this.open = false;
      };

      addEventListener("keydown", keydown);
      return () => removeEventListener("keydown", keydown);
    });
  }

  async show() {
    this.open = true;
    this.query = "";

    if (!this.documents.length) this.documents = (await import("virtual:docs-search")).default;
  }

  hide() {
    this.open = false;
  }

  get results(): Result[] {
    const terms = this.query.toLowerCase().split(/\s+/).filter(Boolean);

    if (!terms.length) return [];

    const scored: [number, Result][] = [];

    for (const { path, title, sections } of this.documents)
      for (const { id, heading, text } of sections) {
        const fields = [title.toLowerCase(), heading.toLowerCase(), text.toLowerCase()];

        if (!terms.every(term => fields.some(field => field.includes(term)))) continue;

        const score = terms.reduce((sum, term) => sum + (fields[0].includes(term) ? 3 : 0) + (fields[1].includes(term) ? 2 : 0), 0);
        const at = text.toLowerCase().indexOf(terms[0]);

        scored.push([score, {
          to: id ? `${path}#${id}` : path,
          title,
          heading: id ? heading : "",
          text: at < 0 ? text.slice(0, 120) : (at > 40 ? "…" : "") + text.slice(Math.max(0, at - 40), at + 80),
        }]);
      }

    return scored.sort((a, b) => b[0] - a[0]).slice(0, 8).map(([, result]) => result);
  }

  render() {
    const { open, query, results, is } = this;

    return (
      <>
        <button type="button" onClick={this.show} _trigger>
          Search <kbd _kbd>⌘K</kbd>
        </button>
        {open && (
          <div role="dialog" aria-label="Search" onClick={this.hide} _overlay>
            <div onClick={event => event.stopPropagation()} _panel>
              <input autoFocus placeholder="Search docs" value={query} onInput={event => (is.query = event.currentTarget.value)} _input />
              <ul _results>
                {results.map(({ to, title, heading, text }) => (
                  <li key={to} onClick={this.hide}>
                    <Link to={to} _result>
                      <strong>{heading ? `${title} › ${heading}` : title}</strong>
                      <span _snippet>{text}</span>
                    </Link>
                  </li>
                ))}
                {query && !results.length && <li _empty>No results</li>}
              </ul>
            </div>
          </div>
        )}
      </>
    );
  }
}

style(Search, $ => ({
  _trigger: {
    row: 8,
    justifyContent: "space-between",
    width: "100%",
    font: "inherit",
    fontSize: "0.85rem",
    color: $.muted,
    background: $.code,
    border: ["1px", "solid", $.line],
    borderRadius: 8,
    padding: [6, 10],
    marginBottom: 12,
    cursor: "pointer",
  },
  _kbd: { fontFamily: $.mono, fontSize: "0.75rem" },
  _overlay: { position: "fixed", inset: 0, background: "rgb(0 0 0 / 0.4)", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "12vh", zIndex: 10 },
  _panel: { width: "min(640px, 92vw)", background: $.paper, color: $.ink, borderRadius: 12, border: ["1px", "solid", $.line], overflow: "hidden" },
  _input: { width: "100%", boxSizing: "border-box", font: "inherit", fontSize: "1rem", padding: [14, 16], border: 0, borderBottom: ["1px", "solid", $.line], background: "transparent", color: $.ink, outline: "none" },
  _results: { listStyle: "none", margin: 0, padding: 8, maxHeight: "60vh", overflowY: "auto" },
  _result: { display: "block", padding: [8, 10], borderRadius: 8, color: $.ink, textDecoration: "none", ":hover": { background: $.code } },
  _snippet: { display: "block", fontSize: "0.8rem", color: $.muted, marginTop: 2 },
  _empty: { padding: 12, color: $.muted },
}));

export function ThemeToggle() {
  const toggle = () => {
    const theme = document.documentElement.dataset.theme == "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  };

  return <button type="button" onClick={toggle} aria-label="Toggle theme" _button>Theme</button>;
}

style(ThemeToggle, $ => ({
  _button: { font: "inherit", fontSize: "0.8rem", color: $.muted, background: "none", border: ["1px", "solid", $.line], borderRadius: 6, padding: [2, 8], cursor: "pointer" },
}));

interface PreProps {
  children?: Component.Node;
  className?: string;
  style?: Record<string, string>;
}

export class Pre extends Component<PreProps> {
  copied = false;
  element: HTMLPreElement | null = null;

  async copy() {
    await navigator.clipboard.writeText(this.element?.textContent ?? "");
    this.copied = true;
    setTimeout(() => (this.copied = false), 1500);
  }

  render() {
    const { copied } = this;
    const { children, className, style: inline } = this.props as PreProps;

    return (
      <div _block>
        <pre className={className} style={inline} tabIndex={0} ref={(element: HTMLPreElement | null) => { this.element = element; }}>{children}</pre>
        <button type="button" onClick={this.copy} aria-label="Copy code" _copy>{copied ? "Copied" : "Copy"}</button>
      </div>
    );
  }
}

style(Pre, $ => ({
  _block: { position: "relative", ":hover": { _copy: { opacity: 1 } } },
  _copy: { position: "absolute", top: 8, right: 8, opacity: 0, font: "inherit", fontSize: "0.75rem", color: $.muted, background: $.paper, border: ["1px", "solid", $.line], borderRadius: 6, padding: [2, 8], cursor: "pointer" },
}));

const pages = (function flat(nodes: Node[]): { title: string; path: string }[] {
  return nodes.flatMap(node => ("path" in node ? [node] : flat(node.pages)));
})(tree);

export function Pager({ path }: { path: string }) {
  const index = pages.findIndex(page => page.path == path);
  const prev = index > 0 && pages[index - 1];
  const next = index >= 0 && index < pages.length - 1 && pages[index + 1];

  return (
    <nav aria-label="Pages" _pager>
      {prev ? <Link to={prev.path} _prev>← {prev.title}</Link> : <span />}
      {next && <Link to={next.path} _next>{next.title} →</Link>}
    </nav>
  );
}

style(Pager, $ => ({
  _pager: { display: "flex", justifyContent: "space-between", gap: 12, marginTop: 48, paddingTop: 16, borderTop: ["1px", "solid", $.line] },
  _a: { color: $.accent, textDecoration: "none" },
}));
