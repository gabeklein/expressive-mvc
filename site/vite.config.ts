import { defineConfig } from "vite";

import mdx from "./mdx/vite.ts";
import { docsTree } from "./tree.ts";

export default defineConfig({
  plugins: [mdx(), docsTree("../website/content/docs")],
  resolve: { dedupe: ["@expressive/dev", "@expressive/dom", "@expressive/mvc"] },
});
