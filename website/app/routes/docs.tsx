import type { Route } from './+types/docs';
import { DocsLayout, type DocsLayoutProps } from 'fumadocs-ui/layouts/docs';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle
} from 'fumadocs-ui/layouts/docs/page';
import { source } from '@/lib/source';
import Logo from '@/components/Logo';
import { docsComponents } from '@/components/docs/mdx';
import docsMdxComponents from '@/components/DocsMdx';
import {
  DocsSocialLinks,
  MobileHeaderActions,
  MobileSearchActions,
  docsLinks,
} from '@/components/ProjectLinks';
import { siteImage, siteTitle } from '@/lib/meta';
import browserCollections from 'fumadocs-mdx:collections/browser';
import { useFumadocsLoader } from 'fumadocs-core/source/client';

const layoutOptions: Omit<DocsLayoutProps, 'tree'> = {
  nav: { title: <Logo />, children: <MobileHeaderActions docs={false} /> },
  searchToggle: { components: { sm: <MobileSearchActions /> } },
  links: docsLinks,
  sidebar: { footer: <DocsSocialLinks /> },
};

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = params['*'].split('/').filter((v) => v.length > 0);
  const page = source.getPage(slugs);
  if (!page) throw new Response('Not found', { status: 404 });

  return {
    slugs: page.slugs,
    path: page.path,
    pageTree: await source.serializePageTree(source.getPageTree())
  };
}

const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, frontmatter, default: Mdx }) {
    return (
      <DocsPage toc={toc}>
        <title>{frontmatter.title}</title>
        <meta name="description" content={frontmatter.description} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content={siteTitle} />
        <meta property="og:title" content={`${frontmatter.title} - ${siteTitle}`} />
        <meta property="og:description" content={frontmatter.description} />
        <meta property="og:image" content={siteImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${frontmatter.title} - ${siteTitle}`} />
        <meta name="twitter:description" content={frontmatter.description} />
        <meta name="twitter:image" content={siteImage} />
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <Mdx components={{ ...docsMdxComponents, ...docsComponents }} />
        </DocsBody>
      </DocsPage>
    );
  }
});

export default function Page({ loaderData }: Route.ComponentProps) {
  const { pageTree } = useFumadocsLoader(loaderData);

  return (
    <DocsLayout {...layoutOptions} tree={pageTree}>
      {clientLoader.useContent(loaderData.path)}
    </DocsLayout>
  );
}
