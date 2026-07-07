import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Logo from '@/components/Logo';
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
  nav: { title: <Logo /> },
  links: [
    { text: 'Docs', url: '/docs' },
    { text: 'Playground', url: '/examples' },
  ],
  githubUrl: 'https://github.com/gabeklein/expressive-mvc',
};

export function meta() {
  return [
    { title: 'Expressive MVC' },
    {
      name: 'description',
      content: 'Class-based state for modern React applications',
    },
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
