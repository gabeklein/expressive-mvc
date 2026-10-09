import { init, parse } from "es-module-lexer";
import { transformWithOxc } from "vite";

import type { ExportScanner } from "./routes";

export const scanExports: ExportScanner = async (source, path) => {
  const { code } = await transformWithOxc(source, path, { jsx: { runtime: "automatic" } });

  await init;

  return parse(code)[1].map(entry => entry.n);
};
