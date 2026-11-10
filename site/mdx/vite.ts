import { fileURLToPath } from "node:url";
import rollup, { type Options as MdxOptions } from "@mdx-js/rollup";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import type { Plugin } from "vite";

import { remarkToc, type Options as TocOptions } from "./toc.ts";

export interface Options extends Omit<MdxOptions, "jsxImportSource" | "providerImportSource"> {
  toc?: TocOptions;
}

const PROVIDER = fileURLToPath(new URL("./index.ts", import.meta.url));

/**
 * Compiles `.mdx` for an `@expressive/dev` app - its JSX runtime, `Mdx` as the provider.
 *
 * Each module exports `frontmatter`, `toc` and its content as `default`. Headings get slug ids.
 */
export default function mdx({ toc, remarkPlugins, ...options }: Options = {}): Plugin {
  return {
    enforce: "pre",
    ...(rollup({
      ...options,
      jsxImportSource: "@expressive/dev",
      providerImportSource: PROVIDER,
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm, [remarkToc, toc], ...(remarkPlugins ?? [])],
    }) as Plugin),
  };
}
