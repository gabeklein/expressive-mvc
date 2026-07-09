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
import { Turn } from './Turn';
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
      content: 'Class-based state for modern React applications',
    },
    { property: 'og:title', content: 'Expressive MVC' },
    {
      property: 'og:description',
      content: 'Class-based state for modern React applications',
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
      <Comparison />
      <Turn />
      <Context />
      <View />
      <More />
      <Benefits />
      <CTA />
      <Footer />
    </HomeLayout>
  );
}
