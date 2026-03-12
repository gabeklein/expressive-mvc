import tailwindcss from '@tailwindcss/vite';
import mdx from 'fumadocs-mdx/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'waku/config';

import * as MdxConfig from './source.config.js';

export default defineConfig({
  vite: {
    optimizeDeps: {
      exclude: ['fumadocs-ui', 'fumadocs-core'],
      include: ['fumadocs-core > debug']
    },
    ssr: {
      external: ['@takumi-rs/image-response'],
      noExternal: ['debug']
    },
    plugins: [tailwindcss(), mdx(MdxConfig), tsconfigPaths()]
  }
});
