import { existsSync } from "node:fs";
import { join } from "node:path";

const VITE_CONFIGS = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs"];

export function viteConfigFile(root: string): string | false {
  const found = VITE_CONFIGS.map(name => join(root, name)).find(existsSync);
  return found ?? false;
}
