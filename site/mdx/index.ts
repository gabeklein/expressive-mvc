import { Model } from "@expressive/mvc";
import type { JSX } from "@expressive/dev";

const TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "a", "strong", "em", "del", "hr", "br", "img",
  "code", "pre", "blockquote",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "th", "td",
] as const;

export namespace Mdx {
  export type Tag = (typeof TAGS)[number];
  export type Element = JSX.ElementType;
  export type Components = { [K in Tag]?: Element } & { wrapper?: Element; [name: string]: Element | undefined };
}

/**
 * Components MDX content renders through - one field per markdown element, plus `wrapper`.
 *
 * Subclass to override (`h1 = Heading`) and provide it above the content; the nearest one wins.
 * A field that is not a markdown tag is a component named in MDX (`Card = Card`).
 */
export class Mdx extends Model {
  h1: Mdx.Element = "h1";
  h2: Mdx.Element = "h2";
  h3: Mdx.Element = "h3";
  h4: Mdx.Element = "h4";
  h5: Mdx.Element = "h5";
  h6: Mdx.Element = "h6";
  p: Mdx.Element = "p";
  a: Mdx.Element = "a";
  strong: Mdx.Element = "strong";
  em: Mdx.Element = "em";
  del: Mdx.Element = "del";
  hr: Mdx.Element = "hr";
  br: Mdx.Element = "br";
  img: Mdx.Element = "img";
  code: Mdx.Element = "code";
  pre: Mdx.Element = "pre";
  blockquote: Mdx.Element = "blockquote";
  ul: Mdx.Element = "ul";
  ol: Mdx.Element = "ol";
  li: Mdx.Element = "li";
  table: Mdx.Element = "table";
  thead: Mdx.Element = "thead";
  tbody: Mdx.Element = "tbody";
  tr: Mdx.Element = "tr";
  th: Mdx.Element = "th";
  td: Mdx.Element = "td";

  /** Wraps the whole document, given the content's props and `children`. */
  wrapper?: Mdx.Element = undefined;
}

const PLAIN: Mdx.Components = Object.fromEntries(TAGS.map(tag => [tag, tag]));

/**
 * Called by compiled MDX during render: the nearest `Mdx`'s components as a plain object.
 *
 * With no `Mdx` above, plain intrinsics.
 */
export function useMDXComponents(): Mdx.Components {
  const mdx = Mdx.get(false);

  if (!mdx) return PLAIN;

  const components: Mdx.Components = {};

  for (const key in mdx) {
    const value = (mdx as unknown as Record<string, unknown>)[key];

    if (typeof value == "string" || typeof value == "function") components[key] = value as Mdx.Element;
  }

  return components;
}
