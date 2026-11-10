import { Css } from "@expressive/dev";

class Site extends Css {
  readonly $ink = "#1d1d1f";
  readonly $muted = "#6e6e73";
  readonly $line = "#e3e3e8";
  readonly $accent = "#3a5bd9";
  readonly $code = "#f5f5f7";
  readonly $mono = "ui-monospace, SFMono-Regular, Menlo, monospace";
  readonly $narrow = "@media (max-width: 900px)";

  row(gap?: number) {
    return { display: "flex", alignItems: "center", gap };
  }
}

export const style = Site.use($ => ({
  _a: { color: $.accent, textDecoration: "none" },
  _code: { fontFamily: $.mono, fontSize: "0.9em", background: $.code, padding: "0.1em 0.3em", borderRadius: 4 },
  _pre: {
    fontFamily: $.mono,
    fontSize: "0.85rem",
    lineHeight: 1.5,
    background: $.code,
    padding: [12, 16],
    borderRadius: 8,
    overflowX: "auto",
    _code: { background: "none", padding: 0, fontSize: "inherit" },
  },
  _blockquote: { margin: [16, 0], padding: [4, 16], borderInlineStart: ["3px", "solid", $.line], color: $.muted },
  _table: { borderCollapse: "collapse", width: "100%", margin: [16, 0], display: "block", overflowX: "auto" },
  _th: { textAlign: "start", borderBottom: ["1px", "solid", $.line], padding: [6, 10] },
  _td: { borderBottom: ["1px", "solid", $.line], padding: [6, 10], verticalAlign: "top" },
}));
