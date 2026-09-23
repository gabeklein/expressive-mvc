import type { Config } from '@react-router/dev/config';
import { glob } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createGetUrl, getSlugs } from 'fumadocs-core/source';

const getUrl = createGetUrl('/docs');

export default {
  ssr: false,
  async prerender({ getStaticPaths }) {
    const paths: string[] = [];
    const excluded: string[] = [];

    for (const path of getStaticPaths()) {
      if (!excluded.includes(path)) paths.push(path);
    }

    for await (const entry of glob('**/*.mdx', { cwd: 'content/docs' })) {
      const slugs = getSlugs(entry);
      paths.push(
        getUrl(slugs),
        `/llms.mdx/docs/${[...slugs, 'index.mdx'].join('/')}`
      );
    }

    for await (const entry of glob('**/App.tsx', { cwd: '../examples/pages' }))
      paths.push(`/examples/${dirname(entry)}`);

    return paths;
  }
} satisfies Config;
