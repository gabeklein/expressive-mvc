import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, runnerImport, type Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import mdx from 'fumadocs-mdx/vite';
import * as MdxConfig from './source.config';
import { resolve, join, dirname } from 'path';
import { cp, glob, readFile, writeFile } from 'fs/promises';
import { readdirSync, readFileSync } from 'fs';
import { createGetUrl, getSlugs } from 'fumadocs-core/source';

export default defineConfig(async ({ command }) => ({
  define: {
    __LIB_VERSION__: JSON.stringify(
      JSON.parse(readFileSync(resolve(__dirname, '../packages/react/package.json'), 'utf8')).version
    ),
    __LIB_TESTS__: countTests(resolve(__dirname, '../packages')),
    __LIB_SIZE__: readSize(resolve(__dirname, '../size-report.json')),
    __SANDBOX_DEPS__: JSON.stringify(await sandboxDeps(command === 'build')),
  },
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
}));

function countTests(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += countTests(path);
    else if (/\.test\.(ts|tsx)$/.test(entry.name))
      total += (readFileSync(path, 'utf8').match(/^\s*(it|test)\(/gm) ?? []).length;
  }
  return total;
}

/**
 * Sandpack installs each example's `@expressive/*` deps from npm, where
 * `latest` made the live site disagree with local review - that resolves the
 * workspace, which is never behind. Pin to workspace versions instead, and
 * report the ways the workspace can still be ahead of the registry.
 */
async function sandboxDeps(build: boolean) {
  const dir = resolve(__dirname, '../packages');
  const deps: Record<string, string> = {};

  for (const entry of readdirSync(dir)) {
    const pkg = JSON.parse(readFileSync(join(dir, entry, 'package.json'), 'utf8'));

    if (!pkg.private) deps[pkg.name] = pkg.version;
  }

  warnPending(deps);

  if (build) await assertPublished(deps);

  return deps;
}

async function assertPublished(deps: Record<string, string>) {
  const missing: string[] = [];

  await Promise.all(
    Object.entries(deps).map(async ([name, version]) => {
      const url = `https://registry.npmjs.org/${name.replace('/', '%2f')}/${version}`;

      let response: Response;

      try {
        response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      } catch (error) {
        console.warn(
          `Sandbox: npm unreachable, cannot verify ${name}@${version} - ${(error as Error).message}`
        );
        return;
      }

      if (response.status === 404) missing.push(`${name}@${version}`);
      else if (!response.ok)
        console.warn(
          `Sandbox: npm answered ${response.status} for ${name}@${version}, cannot verify`
        );
    })
  );

  if (missing.length)
    throw new Error(
      'Sandbox dependencies are pinned to versions npm does not have: ' +
        `${missing.join(', ')}.\nEvery live example would fail to install. ` +
        'Publish first, or roll the workspace version back to a released one.'
    );
}

function warnPending(deps: Record<string, string>) {
  const dir = resolve(__dirname, '../.changeset');
  const pending = new Map<string, string[]>();

  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.md') || entry === 'README.md') continue;

    const text = readFileSync(join(dir, entry), 'utf8');
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);

    if (!front) continue;

    for (const [, name] of front[1].matchAll(/^\s*["']?(@expressive\/[a-z-]+)["']?\s*:/gm))
      if (name in deps) pending.set(name, [...(pending.get(name) ?? []), entry]);
  }

  for (const [name, files] of pending)
    console.warn(
      `Sandbox: ${name} pins ${deps[name]}, the last published version, but ` +
        `${files.join(', ')} describes changes not in it. Examples relying on ` +
        'unreleased behavior will not work on the live site until the next release.'
    );
}

function readSize(report: string): string {
  try {
    const bytes = JSON.parse(readFileSync(report, 'utf8'))['react: typical app'];
    return JSON.stringify(typeof bytes === 'number' ? bytes : null);
  } catch {
    return 'null';
  }
}

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
