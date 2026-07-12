import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import mdx from 'fumadocs-mdx/vite';
import * as MdxConfig from './source.config';
import { resolve, join } from 'path';
import { cp, readFile, writeFile, mkdir } from 'fs/promises';

export default defineConfig({
  server: {
    allowedHosts: ['.trycloudflare.com'],
  },
  resolve: {
    alias: {
      '@examples': resolve(__dirname, '../examples')
    }
  },
  plugins: [
    mdx(MdxConfig),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    serveSkills(),
    editSink()
  ]
});

interface Edit {
  file: string;
  line: number;
  endLine: number;
  original: string;
  updated: string;
}

function renderReadout(edits: Edit[]): string {
  const byFile = new Map<string, Edit[]>();
  for (const edit of edits) {
    const list = byFile.get(edit.file) ?? [];
    list.push(edit);
    byFile.set(edit.file, list);
  }

  const sections: string[] = [
    `# Pending docs edits (${edits.length})`,
    '',
    'Apply each change by locating the block at the given line in the file and',
    'replacing its prose with the NEW text, preserving surrounding markdown.',
    ''
  ];

  for (const [file, list] of byFile) {
    sections.push(`## ${file}`, '');
    for (const edit of list.sort((a, b) => a.line - b.line)) {
      const range =
        edit.endLine > edit.line
          ? `lines ${edit.line}-${edit.endLine}`
          : `line ${edit.line}`;
      sections.push(
        `### ${range}`,
        '',
        'OLD:',
        '```',
        edit.original,
        '```',
        '',
        'NEW:',
        '```',
        edit.updated,
        '```',
        ''
      );
    }
  }

  return sections.join('\n');
}

function editSink(): Plugin {
  const outDir = resolve(__dirname, '.edits');
  return {
    name: 'docs-edit-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__edit', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const { edits } = JSON.parse(body || '{}') as { edits: Edit[] };
            await mkdir(outDir, { recursive: true });
            await writeFile(join(outDir, 'pending.md'), renderReadout(edits));
            await writeFile(
              join(outDir, 'pending.json'),
              JSON.stringify(edits, null, 2)
            );
            server.config.logger.info(
              `[docs-edit] ${edits.length} pending edit(s) written to website/.edits/pending.md`
            );
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, count: edits.length }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      });
    }
  };
}

function serveSkills(): Plugin {
  const dir = resolve(__dirname, '../skills');
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
