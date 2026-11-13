import { rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";

import { prerenderBuild } from "./build";

export interface Page {
  path: string;
  html: string;
  blank: boolean;
}

export interface Renderer {
  paths(): Promise<string[]>;
  render(path: string, shell: string): Promise<Page>;
  close(): void;
}

interface Bundle {
  default(path: string): Promise<{ html: string; css: string; head: string; path: string }>;
  paths(): Promise<string[]>;
}

const ROOT = /(<div\b[^>]*\bid=["']root["'][^>]*>)\s*(<\/div>)/;
const CHARSET = /<meta\b[^>]*\bcharset\b[^>]*>/i;
const HEAD = /<head\b[^>]*>/i;
const mark = (html: string) => html && `<!--prerender-->${html}<!--/prerender-->`;

/** Bundle the app for Node with client transforms - remote modules stay call stubs - and render pages from it. */
export async function launch(root: string): Promise<Renderer> {
  const outDir = join(root, "dist", ".prerender");

  await build(prerenderBuild(root, outDir));

  const url = pathToFileURL(join(outDir, "prerender.js"));
  url.search = String(Date.now());

  const { default: page, paths }: Bundle = await import(url.href);

  return {
    paths,
    async render(path, shell) {
      if (!ROOT.test(shell)) throw new Error("The shell has no empty #root element.");

      const { html, css, head, path: at } = await page(path);
      const style = css && `<style data-expressive="prerender">${css}</style>`;

      return {
        path: at,
        blank: !html.replace(/<!--[\s\S]*?-->/g, "").trim(),
        html: shell
          .replace(ROOT, (_, open, close) => open + html + close)
          .replace(CHARSET.test(shell) ? CHARSET : HEAD, lead => lead + mark(head))
          .replace("</head>", `${style}</head>`),
      };
    },
    close: () => rmSync(outDir, { recursive: true, force: true }),
  };
}
