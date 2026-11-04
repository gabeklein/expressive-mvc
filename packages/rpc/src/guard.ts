export const SERVER_ONLY: readonly string[] = ["Current", "handler", "isCall", "reply", "send", "toNode", "toRequest"];

const IMPORT = /\b(?:import|export)\s+(type\s+)?([^"'`;]*?)\s*from\s*["']@expressive\/rpc\/http["']/g;

export function guard(code: string): string | undefined {
  const found = new Set<string>();

  for (const [, typeOnly, clause] of code.matchAll(IMPORT)) {
    const named = !typeOnly && /\{([^}]*)\}/.exec(clause);

    if (named)
      for (const binding of named[1].split(",")) {
        const [name] = binding.trim().split(/\s+/);
        if (SERVER_ONLY.includes(name)) found.add(name);
      }
  }

  if (found.size)
    return `imports ${[...found].join(", ")} from @expressive/rpc/http, which only a server has - its browser build does not export ${found.size > 1 ? "them" : "it"}.`;
}
