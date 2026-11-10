declare module "*.mdx" {
  import type { Component } from "@expressive/mvc";

  export const frontmatter: Record<string, unknown> | undefined;
  export const toc: { depth: number; id: string; title: string }[];

  export default function MDXContent(props: { components?: Record<string, unknown> }): Component.Node;
}
