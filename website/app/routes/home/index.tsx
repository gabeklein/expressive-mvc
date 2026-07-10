import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Logo from '@/components/Logo';
import { MobileHeaderActions, MobileSearchActions, projectLinks } from '@/components/ProjectLinks';
import { Background } from './Background';
import { Benefits } from './Benefits';
import { Comparison } from './Comparison';
import { Complicated } from './Complicated';
import { Context } from './Context';
import { CTA } from './CTA';
import { Footer } from './Footer';
import { Hero } from './Hero';
import { More } from './More';
import { Product } from './Product';
import { Rails } from './Turn';
import { View } from './View';

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
        'Cleaner React state with smaller components and fewer lines per feature',
    },
    { property: 'og:title', content: 'Expressive MVC' },
    {
      property: 'og:description',
      content:
        'Cleaner React state with smaller components and fewer lines per feature',
    },
    { property: 'og:image', content: '/brand/logo.png' },
    { name: 'twitter:card', content: 'summary' },
    { name: 'twitter:image', content: '/brand/logo.png' },
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
      <View />
      <Rails />
      <More />
      <Benefits />
      <CTA />
      <Footer />
    </HomeLayout>
  );
}
