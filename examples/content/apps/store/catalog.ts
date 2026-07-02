export interface Product {
  id: string;
  emoji: string;
  name: string;
  category: string;
  price: number;
}

export interface Category {
  slug: string;
  label: string;
}

// The "inventory": emoji grouped by category. One source of truth that the
// storefront grid, product page, and breadcrumbs all read from.
const INVENTORY: Record<string, [emoji: string, name: string][]> = {
  food: [
    ['🍕', 'Pizza'],
    ['🍔', 'Burger'],
    ['🌮', 'Taco'],
    ['🍣', 'Sushi'],
    ['🍩', 'Donut'],
    ['🍦', 'Ice Cream']
  ],
  animals: [
    ['🐶', 'Dog'],
    ['🐱', 'Cat'],
    ['🦊', 'Fox'],
    ['🐼', 'Panda'],
    ['🦁', 'Lion'],
    ['🐧', 'Penguin']
  ],
  faces: [
    ['😀', 'Grinning'],
    ['😎', 'Cool'],
    ['🤖', 'Robot'],
    ['👻', 'Ghost'],
    ['🤠', 'Cowboy'],
    ['🥳', 'Party']
  ],
  nature: [
    ['🌵', 'Cactus'],
    ['🌊', 'Wave'],
    ['🔥', 'Fire'],
    ['🌈', 'Rainbow'],
    ['⭐', 'Star'],
    ['🌙', 'Moon']
  ]
};

const CATEGORY_LABEL: Record<string, string> = {
  food: 'Food',
  animals: 'Animals',
  faces: 'Faces',
  nature: 'Nature'
};

const slug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

// Prices are rolled once, at module load, from a fixed range - so they stay
// stable while you browse but differ run-to-run.
const roll = () => Math.round((2 + Math.random() * 48) * 100) / 100;

export const categories: Category[] = Object.keys(INVENTORY).map((s) => ({
  slug: s,
  label: CATEGORY_LABEL[s]
}));

export const products: Product[] = Object.entries(INVENTORY).flatMap(
  ([category, items]) =>
    items.map(([emoji, name]) => ({
      id: slug(name),
      emoji,
      name,
      category,
      price: roll()
    }))
);

const byId = new Map(products.map((p) => [p.id, p]));

export const getProduct = (id: string) => byId.get(id);

export const inCategory = (cat: string) =>
  products.filter((p) => p.category === cat);

export const categoryLabel = (cat: string) => CATEGORY_LABEL[cat] ?? cat;

export const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
