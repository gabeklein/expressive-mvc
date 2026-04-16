import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { Background } from '@/components/AnimateBG';
import Logo from '@/components/Logo';
import { Hero } from './Hero';
import { Problem, Solution } from './Examples';
import { Benefits } from './Benefits';
import { CTA } from './CTA';

export const layoutOptions: BaseLayoutProps = {
  nav: { title: <Logo /> },
  links: [
    { text: 'Docs', url: '/docs' },
    { text: 'Playground', url: '/examples' }
  ],
  githubUrl: 'https://github.com/gabeklein/expressive-state'
};

export function meta() {
  return [
    { title: 'Expressive State' },
    {
      name: 'description',
      content: 'A class-based state backbone for modern UI applications'
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
