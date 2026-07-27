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
import { Rails } from './Rails';

export const layoutOptions: BaseLayoutProps = {
  nav: { title: <Logo />, children: <MobileHeaderActions /> },
  searchToggle: { components: { sm: <MobileSearchActions /> } },
  links: projectLinks,
};

export function meta() {
  return [
    { title: 'Expressive MVC' },
    {
      name: 'description',
      content:
        'Class-based state for React. Smaller components, fewer lines per feature.... zero cap.',
    },
    { property: 'og:title', content: 'Expressive MVC' },
    {
      property: 'og:description',
      content: 'murdering the state game with this one 🔥',
    },
    { property: 'og:image', content: 'https://refactor-micha-snipe.expressive-state.pages.dev/brand/og-micha.png' },
    { property: 'og:image:width', content: '2400' },
    { property: 'og:image:height', content: '1260' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    {
      name: 'twitter:description',
      content: 'murdering the state game with this one 🔥',
    },
    { name: 'twitter:image', content: 'https://refactor-micha-snipe.expressive-state.pages.dev/brand/og-micha.png' },
  ];
}

export default function Home() {
  return (
    <HomeLayout {...layoutOptions} className="[--content-width:1080px] home-sections">
      <Background />
      <Hero />
      <Complicated />
      <Product />
      <Comparison />
      <Context />
      <ComponentSection />
      <Rails />
      <Primitives />
      <Benefits />
      <CTA />
      <Footer />
    </HomeLayout>
  );
}
