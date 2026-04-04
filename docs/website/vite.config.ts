import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import mdx from 'fumadocs-mdx/vite';
import * as MdxConfig from './source.config';
import { resolve, join } from 'path';
import { cp, readFile, readdir } from 'fs/promises';

function serveLlm(): Plugin {
  const dir = resolve(__dirname, '../../skills');
  return {
    name: 'serve-llm',
    configureServer(server) {
      server.middlewares.use('/llm', async (req, res) => {
        try {
          const file = join(dir, req.url || '/');
          const content = await readFile(file);
          res.setHeader('Content-Type', 'text/plain');
          res.end(content);
        } catch {
          res.statusCode = 404;
          res.end('Not found');
        }
      });
    },
    async writeBundle({ dir: outDir }) {
      if (outDir) await cp(dir, join(outDir, 'llm'), { recursive: true });
    }
  };
}

function examplesManifest(): Plugin {
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

      const files = await readdir(directory, { withFileTypes: true });
      const examples: Record<string, Record<string, string>> = {};
      const base: Record<string, string> = {};

      for (const entry of files)
        if (entry.isDirectory()) {
          const dirPath = join(directory, entry.name);
          const files: Record<string, string> = {};
          for (const file of await readdir(dirPath))
            files[`/${file}`] = await readFile(join(dirPath, file), 'utf-8');

          if (entry.name === '_base') Object.assign(base, files);
          else examples[entry.name] = files;
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

export default defineConfig({
  plugins: [
    mdx(MdxConfig),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    serveLlm(),
    examplesManifest()
  ]
});
