import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import mdx from 'fumadocs-mdx/vite';
import * as MdxConfig from './source.config';
import { resolve, join, dirname } from 'path';
import { cp, glob, readFile, writeFile } from 'fs/promises';
import { createGetUrl, getSlugs } from 'fumadocs-core/source';

export default defineConfig({
  optimizeDeps: {
    include: [
      '@codemirror/autocomplete',
      '@codemirror/state',
      '@codemirror/view',
      '@codesandbox/sandpack-react',
      'lucide-react',
      'next-themes',
      'react',
      'react-dom',
      'react/jsx-dev-runtime',
      'react/jsx-runtime',
    ],
  },
  server: {
    port: 8080,
    headers: {
      'Cache-Control': 'no-store',
    },
    allowedHosts: ['.trycloudflare.com', ...(process.env.STAGING_HOST ? [process.env.STAGING_HOST] : [])],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@examples': resolve(__dirname, '../examples')
    }
  },
  plugins: [
    mdx(MdxConfig),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    exampleNotes(),
    serveSkills()
  ]
});

const NOTES = 'virtual:example-notes';

/**
 * Example READMEs as a slug -> markdown map. Read off disk rather than
 * import.meta.glob'd because fumadocs-mdx claims every `*.md` id (including
 * `?raw`) and would hand back a compiled MDX component instead of source.
 */
function exampleNotes(): Plugin {
  const resolved = `\0${NOTES}`;
  const root = resolve(__dirname, '../examples/pages');

  return {
    name: 'example-notes',
    resolveId(id) {
      if (id === NOTES) return resolved;
    },
    async load(id) {
      if (id !== resolved) return;

      const notes: Record<string, string> = {};

      for await (const entry of glob('**/README.md', { cwd: root })) {
        notes[dirname(entry)] = await readFile(join(root, entry), 'utf8');
        this.addWatchFile(join(root, entry));
      }

      return `export default ${JSON.stringify(notes)}`;
    },
    configureServer(server) {
      server.watcher.on('all', (_event, file) => {
        if (!file.endsWith('README.md')) return;

        const mod = server.moduleGraph.getModuleById(resolved);
        if (mod) server.reloadModule(mod);
      });
    }
  };
}

function serveSkills(): Plugin {
  // Site-owned llm content overlays the skills copy under the same /llm root.
  const dirs = [resolve(__dirname, '../skills'), resolve(__dirname, 'content/llm')];
  return {
    name: 'serve-llm',
    configureServer(server) {
      server.middlewares.use('/llm', async (req, res) => {
        for (const dir of dirs)
          try {
            const content = await readFile(join(dir, req.url || '/'));
            res.setHeader('Content-Type', 'text/plain');
            res.end(content);
            return;
          } catch {}

        res.statusCode = 404;
        res.end('Not found');
      });
    },
    async writeBundle({ dir: outDir }) {
      if (!outDir) return;

      for (const dir of dirs)
        await cp(dir, join(outDir, 'llm'), { recursive: true });

      const getUrl = createGetUrl('/docs');
      const paths = ['/', '/examples'];

      for await (const entry of glob('**/*.mdx', { cwd: resolve(__dirname, 'content/docs') }))
        paths.push(getUrl(getSlugs(entry)));

      for await (const entry of glob('**/App.tsx', { cwd: resolve(__dirname, '../examples/pages') }))
        paths.push(`/examples/${dirname(entry)}`);

      const sitemap =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        paths.map((path) => `  <url><loc>https://expressive.dev${path}</loc></url>`).join('\n') +
        '\n</urlset>';

      await writeFile(join(outDir, 'sitemap.xml'), sitemap);
    }
  };
}
