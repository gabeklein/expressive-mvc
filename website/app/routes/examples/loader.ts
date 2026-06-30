// Shared stylesheet lives at the examples root - pull it in directly.
import styles from '@examples/global.css?raw';
import structure, { type GroupModule } from '@examples/structure';

// Manifests drive group order, group labels, and example order - shared with
// the dev-harness SPA via @examples/structure. Imported eagerly as modules.
const ORDER = Object.values(
  import.meta.glob<string[]>('@examples/index.ts', { eager: true, import: 'default' })
)[0];

const MANIFESTS: Record<string, GroupModule> = {};

Object.entries(
  import.meta.glob<GroupModule>('@examples/*/index.ts', { eager: true })
).forEach(([path, m]) => {
  MANIFESTS[path.split('/').at(-2)!] = m;
})

export const GROUPS = structure(ORDER, MANIFESTS);

// Default redirect target: first example in manifest order that has files.
export const REDIRECT = GROUPS
  .flatMap((g) => g.items.map((e) => `${g.slug}/${e.slug}`))
  .find((name) => examples[name]);

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

  // Dev-harness shell - not shipped into sandboxes.
  if (segments[0] === 'app') continue;

  // Shared chrome library. Examples import via the `@common` dev alias; only
  // files an example actually reaches ship with its sandbox (see getFiles).
  if (segments[0] === 'common') {
    common[['', ...segments, file].join('/')] = code;
    continue;
  }

  const slug = segments.join('/');
  const target = examples[slug] ??= {};
  // Sandboxes have no alias resolution - point at the adjacent folder instead.
  target[`/${file}`] = code.replace(/(['"])@common(?=[/'"])/g, '$1./common');
}

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