export interface Match {
  params: Record<string, string>;
  /**
   * Higher = more specific. Per fixed segment: literal=100, :param=10.
   * Catch-all subtracts 1; pure-literal patterns add 1.
   */
  score: number;
}

/**
 * Match a `path` against a route `pattern`. Returns captured params + specificity
 * score on success, or null on no match.
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
  let score = catchAll ? -1 : 1;

  for (let i = 0; i < fixed; i++) {
    const p = patternParts[i];
    const v = pathParts[i];
    if (p.startsWith(':')) {
      params[p.slice(1)] = v;
      score += 10;
    } else if (p.toLowerCase() === v.toLowerCase()) {
      score += 100;
    }
    else return null;
  }

  if (catchAll) params['*'] = pathParts.slice(fixed).join('/');

  return { params, score };
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

function split(path: string) {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? [] : trimmed.split('/');
}
