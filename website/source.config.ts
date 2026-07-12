import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { rehypeSourcePos } from './app/lib/rehype-source-pos';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: {
      includeProcessedMarkdown: true
    }
  }
});

const editable = process.env.NODE_ENV !== 'production';

export default defineConfig({
  mdxOptions: {
    rehypePlugins: (plugins) =>
      editable ? [...plugins, rehypeSourcePos] : plugins
  }
});
