export interface Match {
  params: Record<string, string>;
}

/**
 * Match a `path` against a route `pattern`. Returns captured params on success,
 * or null on no match.
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
    if (p.startsWith(':'))
      params[p.slice(1)] = v;
    else if (p.toLowerCase() !== v.toLowerCase())
      return null;
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
 * The concrete prefix of `path` that `pattern` claims, with `:param` segments
 * taking their value from the corresponding path segment. Literal segments must
 * agree (case-insensitive). Returns null when they don't, or when `path` is
 * shorter than `pattern`. Trailing catch-all should be stripped by the caller -
 * this matches a fixed-length prefix only.
 */
export function fillPath(pattern: string, path: string): string | null {
  const pat = split(pattern);
  const parts = split(path);

  if (parts.length < pat.length) return null;

  for (let i = 0; i < pat.length; i++) {
    const p = pat[i];
    if (!p.startsWith(':') && p.toLowerCase() !== parts[i].toLowerCase())
      return null;
  }

  return '/' + parts.slice(0, pat.length).join('/');
}

/**
 * Substitute a pattern's `:param` segments from a params map. A param absent
 * from the map is left in place (`:name`), so the caller can detect it as
 * unresolved. Literal segments pass through unchanged.
 */
export function fillParams(pattern: string, params: Record<string, string | undefined>): string {
  const parts = split(pattern).map((p) => {
    if (!p.startsWith(':')) return p;
    const v = params[p.slice(1)];
    return v === undefined ? p : v;
  });

  return '/' + parts.join('/');
}

function split(path: string) {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? [] : trimmed.split('/');
}
