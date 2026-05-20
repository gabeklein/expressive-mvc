// `*/**/*` requires at least one folder under examples/ - skips top-level
// SPA scaffolding (package.json, vite.config.ts, main.tsx, etc.).
const FILES = import.meta.glob('@examples/*/**/*', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

const ENTRY = `\
import './styles.css';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
`;

// Strips a leading `NN-` ordering prefix from each path segment.
const STRIP = /^\d+-/;
const slugify = (segments: string[]) => segments.map((s) => s.replace(STRIP, '')).join('/');

export const examples: Record<string, Record<string, string>> = {};
export const base: Record<string, string> = {};

for (const [path, code] of Object.entries(FILES)) {
  if (path.includes('/dist/')) continue;

  // Vite resolves the @examples alias; key may be '@examples/...' (literal)
  // or '/.../examples/...' (resolved). Split on either boundary.
  const segments = path.split(/[/@]examples\//).pop()!.split('/');
  const file = segments.pop()!;

  if (segments.includes('_base')) {
    if (file.includes('styles.css'))
      base[`/${file}`] = code;
    continue;
  }

  const slug = slugify(segments);
  const target = examples[slug] ??= {};
  target[`/${file}`] = code;
}

for (const folder of Object.values(examples)) {
  const cssImports = Object.keys(folder)
    .filter((p) => p.endsWith('.css'))
    .map((p) => `import '.${p}';\n`)
    .join('');

  folder['/index.tsx'] = cssImports + ENTRY;
}

export function getFiles(name: string) {
  const source = examples[name];
  const files: Record<string, any> = {};

  for (const [path, code] of Object.entries(base))
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

  return files;
}

export const NAMES = Object.keys(examples);
