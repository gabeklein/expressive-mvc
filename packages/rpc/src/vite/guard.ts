import { initSync, parse } from "es-module-lexer";
import { transformWithOxc } from "vite";

import { SCRIPT } from "./manifest";

export const SERVER_ONLY: readonly string[] = ["Cookies", "Current"];

const ROOT = "@expressive/rpc";

const HOST_ONLY: Record<string, string> = {
  "@expressive/rpc/calls": "the server's calls - only its entry uses them",
  "@expressive/rpc/http": "the host adapter - only a server entry uses it",
  "@expressive/rpc/protocol": "server plumbing - only a server or host module uses it",
};

export function guard(code: string): string | undefined {
  const found = new Set<string>();
  const hosted = new Set<string>();

  if (!code.includes(ROOT)) return;

  initSync();

  for (const { n, ss, se, d } of parse(code)[0]) {
    const host = n !== undefined && Object.hasOwn(HOST_ONLY, n);

    if (host && d > -1) hosted.add(n);
    if ((n !== ROOT && !host) || d !== -1) continue;

    const statement = code.slice(ss, se);

    if (/^(?:import|export)\s+type\b/.test(statement)) continue;

    const named = /\{([^}]*)\}/.exec(statement);
    const values = named ? named[1].split(",").map(binding => binding.trim().split(/\s+/)).filter(([name]) => name && name !== "type").map(([name]) => name) : [];

    if (host && (!/^(?:import|export)\s*\{/.test(statement) || values.length > 0)) hosted.add(n);
    if (!host) for (const name of values) if (SERVER_ONLY.includes(name)) found.add(name);
  }

  const problems = [
    found.size && `imports ${[...found].join(", ")} from ${ROOT}, which only its server build exports.`,
    ...Object.entries(HOST_ONLY).map(([spec, what]) => hosted.has(spec) && `imports ${spec}, ${what}.`),
  ].filter(Boolean);

  if (problems.length) return problems.join(" ");
}

export async function guardScript(code: string, file: string): Promise<string | undefined> {
  if (SCRIPT.test(file) && code.includes(ROOT)) return guard((await transformWithOxc(code, file, { jsx: { runtime: "automatic" } })).code);
}
