import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import Logo from '@/components/Logo';

import { Hero } from './Hero';
import { Background } from './Background';
import { Problem, Solution } from './Examples';
import { Benefits } from './Benefits';
import { CTA } from './CTA';

export const layoutOptions: BaseLayoutProps = {
  nav: { title: <Logo /> },
  links: [
    { text: 'Docs', url: '/docs' },
    { text: 'Playground', url: '/examples' }
  ],
  githubUrl: 'https://github.com/gabeklein/expressive-mvc'
};

export function meta() {
  return [
    { title: 'Expressive MVC' },
    {
      name: 'description',
      content: 'Class-based state for modern React applications'
    }
  ];
}

export default function Home() {
  $contentWidth: "1080px";

  return (
    <HomeLayout {...layoutOptions}>
      <Background />
      <Hero />
      <Problem />
      <Solution />
      <Benefits />
      <CTA />
    </HomeLayout>
  );
}
