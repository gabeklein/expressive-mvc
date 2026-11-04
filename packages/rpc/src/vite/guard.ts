import { initSync, parse } from "es-module-lexer";
import { transformWithOxc } from "vite";

import { SCRIPT } from "./manifest";

export const SERVER_ONLY: readonly string[] = ["Current", "handler", "isCall", "reply", "send", "toNode", "toRequest"];

const HTTP = "@expressive/rpc/http";

export function guard(code: string): string | undefined {
  const found = new Set<string>();

  if (!code.includes(HTTP)) return;

  initSync();

  for (const { n, ss, se, d } of parse(code)[0]) {
    if (n !== HTTP || d !== -1) continue;

    const statement = code.slice(ss, se);
    const named = !/^(?:import|export)\s+type\b/.test(statement) && /\{([^}]*)\}/.exec(statement);

    if (named)
      for (const binding of named[1].split(",")) {
        const [name] = binding.trim().split(/\s+/);
        if (SERVER_ONLY.includes(name)) found.add(name);
      }
  }

  if (found.size)
    return `imports ${[...found].join(", ")} from ${HTTP}, which only a server has - its browser build does not export ${found.size > 1 ? "them" : "it"}.`;
}

export async function guardScript(code: string, file: string): Promise<string | undefined> {
  if (SCRIPT.test(file) && code.includes(HTTP)) return guard((await transformWithOxc(code, file, { jsx: { runtime: "automatic" } })).code);
}
