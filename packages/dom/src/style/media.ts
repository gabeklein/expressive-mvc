const order = [
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'orientation',
  'hover',
  'pointer',
  'prefersColorScheme',
  'prefersReducedMotion'
] as const satisfies readonly (keyof Query)[];

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

type Kebab<K extends string> =
  K extends `${infer A}${infer B}`
    ? A extends Uppercase<A> ? `-${Lowercase<A>}${Kebab<B>}` : `${A}${Kebab<B>}`
    : K;

type Unit<V> = V extends number ? `${V}px` : V & string;

type Features<Q, O extends readonly string[]> =
  O extends readonly [infer K extends string, ...infer R extends readonly string[]]
    ? K extends keyof Q
      ? Q[K] extends undefined
        ? Features<Q, R>
        : [`(${Kebab<K>}: ${Unit<Q[K]>})`, ...Features<Q, R>]
      : Features<Q, R>
    : [];

type Join<T extends readonly string[]> =
  T extends readonly [infer H extends string, ...infer R extends readonly string[]]
    ? R extends [] ? H : `${H} and ${Join<R>}`
    : '';

type Optional<Q> = {
  [K in keyof Q]-?: Q[K] extends undefined ? never : undefined extends Q[K] ? K : never;
}[keyof Q];

type Media<Q extends Query> =
  [Optional<Q>] extends [never]
    ? `@media ${Join<Features<Q, typeof order>>}`
    : `@media ${string}`;

function media<const Q extends Query>(query: Q): Media<Q> {
  const features = [];

  for (const key of order) {
    const value = query[key];

    if (value === undefined) continue;

    const feature = key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

    features.push(`(${feature}: ${typeof value == 'number' ? `${value}px` : value})`);
  }

  return `@media ${features.join(' and ')}` as Media<Q>;
}

export { media };
export type { Query };
