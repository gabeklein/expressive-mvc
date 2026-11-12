import type { Component } from "@expressive/mvc";

import { style } from "../style";

export interface Entry {
  depth: number;
  id: string;
  title: string;
}

export interface Module {
  default: (props: object) => Component.Node;
  frontmatter?: { title?: string; description?: string };
  toc: Entry[];
}

const ROOT = "../../../website/content/docs/";

const files = import.meta.glob<Module>("../../../website/content/docs/**/*.mdx");

const loaders = new Map<string, () => Promise<Module>>();
const loaded = new Map<string, Promise<Module>>();

for (const [file, load] of Object.entries(files)) {
  const slug = file.slice(ROOT.length, -".mdx".length).replace(/(^|\/)index$/, "");
  loaders.set(slug, load);
}

const prose = (Content: Module["default"]) => style(Content, $ => ({
  lineHeight: 1.65,
  _h1: { fontSize: "2rem", marginTop: 0 },
  _h2: { marginTop: 40, paddingBottom: 4, borderBottom: ["1px", "solid", $.line] },
  _img: { maxWidth: "100%" },
}));

export function slugs() {
  return [...loaders.keys()];
}

export function docOf(slug: string): Promise<Module> | undefined {
  const load = loaders.get(slug);

  if (!load) return;

  let doc = loaded.get(slug);

  if (!doc) loaded.set(slug, (doc = load().then(module => (prose(module.default), module))));

  return doc;
}
