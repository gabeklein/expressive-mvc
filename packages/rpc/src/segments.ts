/** The request methods a route module may answer, each as an export of that name. */
export const METHODS: readonly string[] = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

/** How specific a pattern's segment is: a static name over a `:param` over a `*`. */
export const rank = (part: string) => (part === "*" ? 0 : part.startsWith(":") ? 1 : 2);

/** `path` with `base` taken off, or `undefined` when it is not under `base`. */
export function unbased(path: string, base: string): string | undefined {
  const trimmed = base.replace(/\/+$/, "");

  if (!trimmed) return path;
  if (path === trimmed) return "/";
  if (path.startsWith(trimmed + "/")) return path.slice(trimmed.length);
}
