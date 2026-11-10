import { build, type InlineConfig } from "vite";

import { viteConfigFile } from "./config";
import { expressive } from "./plugin";

export interface BuildOptions {
  /** Unminified client output with stable filenames and no sourcemaps. */
  pretty?: boolean;
  /** Default true; false builds in memory. */
  write?: boolean;
  /** Render each static page to `dist/client/<path>/index.html` after the build; the shell moves to `200.html`. */
  prerender?: boolean;
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

/** `expressive build` - the client into `dist/client`, then the server into `dist/server/index.js`. */
export async function runBuild(root = process.cwd(), options: BuildOptions = {}): Promise<void> {
  await build(clientBuild(root, options));
  await build(serverBuild(root, options));

  if (options.prerender) await (await import("./prerender")).prerender(root);
}
