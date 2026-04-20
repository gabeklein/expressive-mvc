import type { Plugin } from 'vite';
import { resolve, join } from 'path';
import { readFile, readdir } from 'fs/promises';

const ENTRY = () => `
import './styles.css';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
`;

export default function sandboxManifest(): Plugin {
  const directory = resolve(__dirname, 'examples');
  const virtualId = 'virtual:examples';
  const resolvedId = '\0' + virtualId;

  return {
    name: 'examples-manifest',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    async load(id) {
      if (id !== resolvedId) return;

      const entries = await readdir(directory, { withFileTypes: true });
      const examples: Record<string, Record<string, string>> = {};
      const base: Record<string, string> = {};

      for (const entry of entries)
        if (entry.isDirectory()) {
          const dirPath = join(directory, entry.name);
          const files: Record<string, string> = {};

          for (const file of await readdir(dirPath))
            files[`/${file}`] = await readFile(join(dirPath, file), 'utf-8');

          if (entry.name === '_base') Object.assign(base, files);
          else examples[entry.name] = files;
        }

      // Generate /index.tsx per example, including imports for any
      // .css siblings so example-local styles auto-load.
      for (const folder of Object.values(examples)) {
        const imports = Object.keys(folder)
          .filter((p) => p.endsWith('.css'))
          .map((p) => `import '.${p}';\n`);

        folder['/index.tsx'] = imports + ENTRY();
      }

      return [
        `export const examples = ${JSON.stringify(examples)};`,
        `export const base = ${JSON.stringify(base)};`,
        `export default examples;`
      ].join('\n');
    },
    configureServer(server) {
      server.watcher.add(directory);
      server.watcher.on('all', (_, file) => {
        if (!file.startsWith(directory)) return;
        const mod = server.moduleGraph.getModuleById(resolvedId);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      });
    }
  };
}
