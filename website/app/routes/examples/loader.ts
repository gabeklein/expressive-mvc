// Shared stylesheet lives at the examples root - pull it in directly.
import styles from '@examples/global.css?raw';
import { home, tree, type Directory } from '@examples/pages';

const leaves = (dirs: Directory[]): Directory[] =>
  dirs.flatMap((d) => (d.children ? leaves(d.children) : d));

export const GROUPS = tree;
export const EXAMPLE_LABELS = Object.fromEntries(
  leaves(GROUPS).map(({ path, label }) => [path, label])
);

// `*/**/*` requires at least one folder under examples/ - skips top-level
// SPA scaffolding (package.json, vite.config.ts, main.tsx, etc.).
const FILES = import.meta.glob('@examples/*/**/*', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

const ENTRY = `\
import './global.css';
import { createRoot } from 'react-dom/client';
import App from './App';

// Matches the dev harness: centers/constrains example content via global.css.
document.body.classList.add('example');

createRoot(document.getElementById('root')!).render(<App />);
`;


export const examples: Record<string, Record<string, string>> = {};
export const layout: Record<string, string> = {};
export const common: Record<string, string> = {};

layout['/global.css'] = styles;

for (const [path, code] of Object.entries(FILES)) {
  if (path.includes('/dist/')) continue;

  // Vite resolves the @examples alias; key may be '@examples/...' (literal)
  // or '/.../examples/...' (resolved). Split on either boundary.
  const segments = path.split(/[/@]examples\//).pop()!.split('/');
  const file = segments.pop()!;

  // Group manifests order the nav; they aren't sandbox files.
  if (file === 'index.ts') continue;

  // Shared chrome library. Examples import via the `@common` dev alias; only
  // files an example actually reaches ship with its sandbox (see getFiles).
  if (segments[0] === 'common') {
    common[['', ...segments, file].join('/')] = code;
    continue;
  }

  // Routable example content lives under pages/<group>/<example>/. Anything
  // else (the app/ dev-shell) is harness, not a sandbox.
  if (segments[0] !== 'pages') continue;

  const slug = segments.slice(1).join('/');
  const target = examples[slug] ??= {};
  // Sandboxes have no alias resolution - point at the adjacent folder instead.
  target[`/${file}`] = code.replace(/(['"])@common(?=[/'"])/g, '$1./common');
}

// Paths that have moved. The old URLs are cited by docs, llms.txt and the
// published skill, so they redirect to the page rather than the landing example.
export const MOVED: Record<string, string> = {
  'apps/forms': 'featured/forms',
  'apps/kanban': 'featured/kanban',
  'apps/spreadsheet': 'featured/spreadsheet',
  'apps/stopwatch': 'featured/stopwatch',
  'apps/tictactoe': 'featured/tictactoe',
  'component/dial': 'component/custom',
  'component/instances': 'component/injection'
};

// Default redirect target: the landing example the dev shell also opens with,
// falling back to the first example in tree order that has files.
export const REDIRECT =
  (home && home in examples && home) ||
  leaves(GROUPS).map((n) => n.path).find((p) => examples[p]);

// Static hosting 308s /examples/<slug> to a trailing slash; normalize so the
// slug still resolves instead of falling through to the default redirect.
export const exampleSlug = (path = '') =>
  path.replace(/^\/examples\//, '').replace(/\/+$/, '');

for (const folder of Object.values(examples)) {
  const cssImports = Object.keys(folder)
    .filter((p) => p.endsWith('.css'))
    .map((p) => `import '.${p}';\n`)
    .join('');

  folder['/index.tsx'] = cssImports + ENTRY;
}

// Matches `import ... '...'` and re-exports (`export ... from '...'`).
const IMPORT = /(?:import|export)\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g;

/** Resolve a relative specifier against the flat `common` registry. */
function resolve(spec: string, from: string) {
  if (!spec.startsWith('.')) return;

  const path = from.split('/').slice(0, -1);

  for (const part of spec.split('/'))
    if (part === '..') path.pop();
    else if (part !== '.') path.push(part);

  const joined = path.join('/');

  for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx'])
    if (joined + suffix in common) return joined + suffix;
}

/** Collect the transitive closure of common files reachable from `code`. */
function collect(code: string, from: string, into: Set<string>) {
  for (const [, spec] of code.matchAll(IMPORT)) {
    const hit = resolve(spec, from);

    if (hit && !into.has(hit)) {
      into.add(hit);
      collect(common[hit], hit, into);
    }
  }
}

export function getFiles(name: string) {
  const source = examples[name];
  const files: Record<string, any> = {};

  for (const [path, code] of Object.entries(layout))
    files[path] = { hidden: true, code };

  // Insertion order drives Sandpack's tab order; push CSS to the end.
  const sorted = Object.entries(source).sort(
    ([a], [b]) => Number(a.endsWith('.css')) - Number(b.endsWith('.css'))
  );

  for (const [path, code] of sorted) {
    if (path === '/index.css') continue;
    // /index.tsx is generated boilerplate from the sandbox plugin.
    files[path] = path === '/index.tsx' ? { hidden: true, code } : code;
  }

  // Shared chrome ships hidden: no editor tab, but present on eject so the
  // sandbox remains a complete, working project.
  const used = new Set<string>();

  for (const [path, code] of Object.entries(source))
    collect(code, path, used);

  for (const path of used)
    files[path] = { hidden: true, code: common[path] };

  return files;
}
