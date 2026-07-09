export const siteTitle = 'Expressive MVC';
export const siteDescription = 'Class-based state for modern React applications';
export const siteImage = '/brand/og.jpg';

export function createMeta({
  title = siteTitle,
  description = siteDescription,
}: {
  title?: string;
  description?: string;
} = {}) {
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: siteTitle },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: siteImage },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: siteImage },
  ];
}
