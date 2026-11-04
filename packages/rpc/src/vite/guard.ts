import { initSync, parse } from "es-module-lexer";
import { transformWithOxc } from "vite";

import { SCRIPT } from "./manifest";

export const SERVER_ONLY: readonly string[] = ["Current"];

const ROOT = "@expressive/rpc";
const HOST = "@expressive/rpc/http";

export function guard(code: string): string | undefined {
  const found = new Set<string>();
  let host = false;

  if (!code.includes(ROOT)) return;

  initSync();

  for (const { n, ss, se, d } of parse(code)[0]) {
    if (n === HOST && d > -1) host = true;
    if ((n !== ROOT && n !== HOST) || d !== -1) continue;

    const statement = code.slice(ss, se);

    if (/^(?:import|export)\s+type\b/.test(statement)) continue;

    const named = /\{([^}]*)\}/.exec(statement);
    const values = named ? named[1].split(",").map(binding => binding.trim().split(/\s+/)).filter(([name]) => name && name !== "type").map(([name]) => name) : [];

    if (n === HOST) host ||= !/^(?:import|export)\s*\{/.test(statement) || values.length > 0;
    else for (const name of values) if (SERVER_ONLY.includes(name)) found.add(name);
  }

  const problems = [
    found.size && `imports ${[...found].join(", ")} from ${ROOT}, which only its server build exports.`,
    host && `imports ${HOST}, the host adapter - only a server entry uses it.`,
  ].filter(Boolean);

  if (problems.length) return problems.join(" ");
}

export async function guardScript(code: string, file: string): Promise<string | undefined> {
  if (SCRIPT.test(file) && code.includes(ROOT)) return guard((await transformWithOxc(code, file, { jsx: { runtime: "automatic" } })).code);
}
