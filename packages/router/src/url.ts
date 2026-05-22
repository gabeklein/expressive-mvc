export interface Match {
  params: Record<string, string>;
}

/**
 * Match a `path` against a route `pattern`. Returns captured params or null.
 *
 * - Literal segments match case-insensitively.
 * - `:name` segments capture into `params.name`.
 * - Trailing `*` is a catch-all that matches zero or more remaining segments,
 *   captured into `params['*']`.
 * - Trailing slashes are normalized (treated as equivalent).
 */
export function matchPattern(pattern: string, path: string): Match | null {
  const patternParts = split(pattern);
  const pathParts = split(path);
  const catchAll = patternParts[patternParts.length - 1] === '*';
  const fixed = catchAll ? patternParts.length - 1 : patternParts.length;

  if (catchAll ? pathParts.length < fixed : pathParts.length !== fixed)
    return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < fixed; i++) {
    const p = patternParts[i];
    const v = pathParts[i];
    if (p.startsWith(':')) params[p.slice(1)] = v;
    else if (p.toLowerCase() !== v.toLowerCase()) return null;
  }

  if (catchAll) params['*'] = pathParts.slice(fixed).join('/');

  return { params };
}

/**
 * Compose a parent base with a relative or absolute `to` pattern, producing
 * the full pattern used for matching. Absolute `to` (leading `/`) ignores base.
 */
export function fullPattern(base: string, to: string): string {
  if (to.startsWith('/')) return to;
  if (!to) return base;
  return base + '/' + to;
}

/**
 * The "own" portion of a `to` pattern that children compose against as their
 * base. Strips trailing catch-all (`/*` or `*`) since catch-all is for
 * matching, not nesting. Empty / pure catch-all yields ''.
 */
export function patternSegment(to: string): string {
  if (!to || to === '*') return '';
  const slashed = to.startsWith('/') ? to : '/' + to;
  return slashed.replace(/\/?\*$/, '');
}

/**
 * Higher score = more specific. Per fixed segment: literal=100, :param=10.
 * Patterns without catch-all get +1 (exact-length match); catch-all gets -1.
 * Used by the resolver to pick the most-specific match among siblings.
 */
export function specificity(pattern: string): number {
  const trimmed = pattern.replace(/^\/+|\/+$/g, '');
  const parts = trimmed === '' ? [] : trimmed.split('/');
  const hasCatchAll = parts[parts.length - 1] === '*';
  const fixed = hasCatchAll ? parts.slice(0, -1) : parts;
  let score = hasCatchAll ? -1 : 1;
  for (const p of fixed) score += p.startsWith(':') ? 10 : 100;
  return score;
}

function split(path: string) {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? [] : trimmed.split('/');
}
