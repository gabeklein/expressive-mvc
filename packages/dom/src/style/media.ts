interface Query {
  minWidth?: number | string;
  maxWidth?: number | string;
  minHeight?: number | string;
  maxHeight?: number | string;
  orientation?: 'portrait' | 'landscape';
  hover?: 'hover' | 'none';
  pointer?: 'fine' | 'coarse' | 'none';
  prefersColorScheme?: 'light' | 'dark';
  prefersReducedMotion?: 'reduce' | 'no-preference';
}

function media(query: Query): `@media ${string}` {
  const features = Object.entries(query).map(([key, value]) => {
    const feature = key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
    return `(${feature}: ${typeof value == 'number' ? `${value}px` : value})`;
  });

  return `@media ${features.join(' and ')}`;
}

export { media };
export type { Query };
