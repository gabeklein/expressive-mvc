import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import mdx from 'fumadocs-mdx/vite';
import * as MdxConfig from './source.config';
import { resolve, join } from 'path';
import { cp, readFile } from 'fs/promises';

export default defineConfig({
  optimizeDeps: {
    include: [
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
