import type { Heading, Root } from "mdast";
import { valueToEstree } from "estree-util-value-to-estree";
import GithubSlugger from "github-slugger";
import { toString } from "mdast-util-to-string";
import { define } from "unist-util-mdx-define";
import { visit } from "unist-util-visit";

type VFile = Parameters<typeof define>[1];

export interface Entry {
  depth: number;
  id: string;
  title: string;
}

export interface Options {
  /** Deepest heading listed. Default 3. */
  depth?: number;
}

export function remarkToc({ depth = 3 }: Options = {}) {
  return (tree: Root, file: VFile) => {
    const slugger = new GithubSlugger();
    const toc: Entry[] = [];

    visit(tree, "heading", (node: Heading) => {
      const title = toString(node);
      const id = slugger.slug(title);
      const data = (node.data ??= {});

      data.hProperties = { ...data.hProperties, id };

      if (node.depth > 1 && node.depth <= depth) toc.push({ depth: node.depth, id, title });
    });

    define(tree, file, { toc: valueToEstree(toc) });
  };
}
