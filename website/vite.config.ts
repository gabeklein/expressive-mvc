import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, runnerImport, type Plugin } from 'vite';
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
    serveSkills()
  ]
});

interface ExampleDirectory {
  label: string;
  path: string;
  file?: string;
  children?: ExampleDirectory[];
}

const EXAMPLES = resolve(__dirname, '../examples/pages.ts');
const EXAMPLES_INDEX = 'examples/index.md';

function examplesIndex(tree: ExampleDirectory[]) {
  const leaves = (dirs: ExampleDirectory[]): ExampleDirectory[] =>
    dirs.flatMap((d) => (d.children ? leaves(d.children) : d.file ? d : []));

  const sections = tree.map((group) =>
    [
      `## ${group.label}`,
      ...leaves(group.children ?? []).map(
        (d) => `- [${d.label}](https://expressive.dev/examples/${d.path})`
      )
    ].join('\n')
  );

  return [
    '# Runnable Examples',
    'Each page below serves the full source of a working program - every file, ' +
      'no JavaScript required to read it. Groups appear in site navigation order. ' +
      'Generated at build from the example manifests.',
    ...sections
  ].join('\n\n') + '\n';
}

function serveSkills(): Plugin {
  // Site-owned llm content overlays the skills copy under the same /llm root.
  const dirs = [resolve(__dirname, '../skills'), resolve(__dirname, 'content/llm')];
  return {
    name: 'serve-llm',
    configureServer(server) {
      server.middlewares.use('/llm', async (req, res) => {
        if (req.url === `/${EXAMPLES_INDEX}`) {
          const { tree } = (await server.ssrLoadModule(EXAMPLES)) as {
            tree: ExampleDirectory[];
          };
          res.setHeader('Content-Type', 'text/plain');
          res.end(examplesIndex(tree));
          return;
        }

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

      const { module } = await runnerImport<{ tree: ExampleDirectory[] }>(EXAMPLES);

      await writeFile(join(outDir, 'llm', EXAMPLES_INDEX), examplesIndex(module.tree));

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
