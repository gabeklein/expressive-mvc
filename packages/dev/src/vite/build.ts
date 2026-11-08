import { build, type InlineConfig } from "vite";

import { viteConfigFile } from "./config";
import { expressive } from "./plugin";

export interface BuildOptions {
  pretty?: boolean;
  write?: boolean;
}

export function clientBuild(root: string, { pretty = false, write = true }: BuildOptions = {}): InlineConfig {
  return {
    root,
    configFile: viteConfigFile(root),
    plugins: [expressive()],
    build: {
      write,
      outDir: "dist/client",
      minify: !pretty,
      sourcemap: !pretty,
      rollupOptions: pretty
        ? { output: { entryFileNames: "[name].js", chunkFileNames: "[name].js", assetFileNames: "[name].[ext]" } }
        : undefined,
    },
  };
}

export function serverBuild(root: string, { write = true }: BuildOptions = {}): InlineConfig {
  return {
    root,
    configFile: viteConfigFile(root),
    plugins: [expressive()],
    build: {
      write,
      ssr: "/.expressive/server.ts",
      outDir: "dist/server",
      rollupOptions: { output: { entryFileNames: "index.js" } },
    },
  };
}

export async function runBuild(root = process.cwd(), options: BuildOptions = {}): Promise<void> {
  await build(clientBuild(root, options));
  await build(serverBuild(root, options));
}
