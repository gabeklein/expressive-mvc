import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Logo from '@/components/Logo';
import { MobileHeaderActions, MobileSearchActions, projectLinks } from '@/components/ProjectLinks';
import { Background } from './Background';
import { Benefits } from './Benefits';
import { Comparison } from './Comparison';
import { Complicated } from './Complicated';
import { ComponentSection } from './Component';
import { Context } from './Context';
import { CTA } from './CTA';
import { Footer } from './Footer';
import { Hero } from './Hero';
import { Primitives } from './Primitives';
import { Product } from './Product';
import { Vibe } from './Vibe';

export const layoutOptions: BaseLayoutProps = {
  nav: { title: <Logo />, children: <MobileHeaderActions /> },
  searchToggle: { components: { sm: <MobileSearchActions /> } },
  links: projectLinks,
};

export function meta() {
  const description =
    'Cleaner React state with smaller components and fewer lines per feature';
  const image = 'https://expressive.dev/brand/og.png';

  return [
    { title: 'Expressive MVC' },
    { name: 'description', content: description },
    { property: 'og:title', content: 'Expressive MVC' },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { property: 'og:image:width', content: '2400' },
    { property: 'og:image:height', content: '1260' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Expressive MVC' },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ];
}

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Expressive MVC',
      url: 'https://expressive.dev',
      logo: 'https://expressive.dev/brand/icon-512.png',
      description:
        'Class-based reactive state management for React. Define models as plain classes; components update when the values they read change.',
      sameAs: [
        'https://github.com/gabeklein/expressive-mvc',
        'https://www.npmjs.com/package/@expressive/react',
      ],
    },
    {
      '@type': 'WebSite',
      name: 'Expressive MVC',
      url: 'https://expressive.dev',
      description:
        'Documentation and interactive examples for Expressive MVC, class-based reactive state management for React.',
    },
  ],
};

export default function Home() {
  return (
    <HomeLayout {...layoutOptions} className="[--content-width:1080px] home-sections">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Background />
      <Hero />
      <Complicated />
      <Product />
      <Comparison />
      <Vibe />
      <Context />
      <ComponentSection />
      <Primitives />
      <Benefits />
      <CTA />
      <Footer />
    </HomeLayout>
  );
}
