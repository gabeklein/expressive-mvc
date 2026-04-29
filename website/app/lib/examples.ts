const FILES = import.meta.glob('/examples/*/*', {
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

export const examples: Record<string, Record<string, string>> = {};
export const base: Record<string, string> = {};

for (const [path, code] of Object.entries(FILES)) {
  const [folder, file] = path.split('/').slice(2);
  const target = folder === '_base' ? base : (examples[folder] ??= {});
  target[`/${file}`] = code;
}

for (const folder of Object.values(examples)) {
  const cssImports = Object.keys(folder)
    .filter((p) => p.endsWith('.css'))
    .map((p) => `import '.${p}';\n`)
    .join('');

  folder['/index.tsx'] = cssImports + ENTRY;
}

export const NAMES = Object.keys(examples);
