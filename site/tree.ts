import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
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
      if (id === ID) return "\0" + ID;
    },
    load(id) {
      if (id !== "\0" + ID) return;

      const tree = walk(root, base, file => this.addWatchFile(file));

      return `export default ${JSON.stringify(tree)};`;
    },
  };
}
