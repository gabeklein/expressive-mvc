import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Logo from '@/components/Logo';
import { MobileHeaderActions, MobileSearchActions, projectLinks } from '@/components/ProjectLinks';
import { createMeta } from '@/lib/meta';
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
  return createMeta();
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
