import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Logo } from '@/components/Logo';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
    },
    links: [
      {
        text: 'Documentation',
        url: '/docs',
      },
    ],
    githubUrl: 'https://github.com/gabeklein/expressive-jsx',
  };
}
