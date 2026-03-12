import stylePlugin from '@expressive/vite-plugin';
import { type Config, defineConfig } from 'waku/config';
import mdx from 'fumadocs-mdx/vite';
import * as MdxConfig from './source.config.js';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  vite: {
    optimizeDeps: {
      exclude: ['fumadocs-ui', 'fumadocs-core', '@fumadocs/ui']
    },
    plugins: [stylePlugin(), tailwindcss(), mdx(MdxConfig), tsconfigPaths()]
  }
});
