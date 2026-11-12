import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import GithubSlugger from "github-slugger";
import { parse } from "yaml";

export interface Leaf {
  title: string;
  path: string;
}

export interface Section {
  title: string;
  pages: Node[];
}

export type Node = Leaf | Section;

const ID = "virtual:docs-tree";
const SEARCH = "virtual:docs-search";

export interface Passage {
  id: string;
  heading: string;
  text: string;
}

export interface Document {
  path: string;
  title: string;
  sections: Passage[];
}

function plain(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*(import|export) .*$/gm, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sectionsOf(source: string, title: string): Passage[] {
  const body = source.replace(/^---\n[\s\S]*?\n---\n?/, "").replace(/```[\s\S]*?```/g, block => block.replace(/^#/gm, " "));
  const slugger = new GithubSlugger();
  const sections: Passage[] = [{ id: "", heading: title, text: "" }];

  for (const line of body.split("\n")) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);

    if (heading) sections.push({ id: slugger.slug(heading[2].trim()), heading: heading[2].trim(), text: "" });
    else sections[sections.length - 1].text += line + "\n";
  }

  return sections
    .map(section => ({ ...section, text: plain(section.text).slice(0, 400) }))
    .filter(section => section.id || section.text);
}

export function docsTree(dir: string, base = "/docs"): Plugin {
  let root = "";

  const titleOf = (file: string, fallback: string) => {
    const head = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, "utf8"));
    const title = head && parse(head[1])?.title;

    return typeof title == "string" ? title : fallback;
  };

  const walk = (folder: string, path: string, watch: (file: string) => void): Node[] => {
    const meta = join(folder, "meta.json");
    watch(meta);

    const { pages = [] } = existsSync(meta) ? JSON.parse(readFileSync(meta, "utf8")) : {};

    return (pages as string[]).flatMap((name): Node[] => {
      const file = join(folder, name + ".mdx");
      const sub = join(folder, name, "meta.json");

      if (existsSync(file)) {
        watch(file);
        return [{ title: titleOf(file, name), path: name === "index" ? path : `${path}/${name}` }];
      }

      if (existsSync(sub)) {
        const { title = name } = JSON.parse(readFileSync(sub, "utf8"));
        return [{ title, pages: walk(join(folder, name), `${path}/${name}`, watch) }];
      }

      return [];
    });
  };

  return {
    name: "docs-tree",
    configResolved(config) {
      root = resolve(config.root, dir);
    },
    resolveId(id) {
      if (id === ID || id === SEARCH) return "\0" + id;
    },
    load(id) {
      if (id !== "\0" + ID && id !== "\0" + SEARCH) return;

      const tree = walk(root, base, file => this.addWatchFile(file));

      if (id === "\0" + ID) return `export default ${JSON.stringify(tree)};`;

      const documents: Document[] = [];
      const visit = (nodes: Node[], folder: string) => {
        for (const node of nodes) {
          if (!("path" in node)) {
            visit(node.pages, folder);
            continue;
          }

          const rest = node.path.slice(base.length).replace(/^\//, "");
          const file = [join(root, rest + ".mdx"), join(root, rest, "index.mdx"), join(root, "index.mdx")].find(existsSync)!;
          documents.push({ path: node.path, title: node.title, sections: sectionsOf(readFileSync(file, "utf8"), node.title) });
        }
      };

      visit(tree, root);
      return `export default ${JSON.stringify(documents)};`;
    },
  };
}
