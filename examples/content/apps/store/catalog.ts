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
const INVENTORY = {
  Food: {
    Pizza: '🍕',
    Burger: '🍔',
    Taco: '🌮',
    Sushi: '🍣',
    Donut: '🍩',
    IceCream: '🍦'
  },
  Animals: {
    Dog: '🐶',
    Cat: '🐱',
    Fox: '🦊',
    Panda: '🐼',
    Lion: '🦁',
    Penguin: '🐧'
  },
  Faces: {
    Grinning: '😀',
    Cool: '😎',
    Robot: '🤖',
    Ghost: '👻',
    Cowboy: '🤠',
    Party: '🥳'
  },
  Nature: {
    Cactus: '🌵',
    Wave: '🌊',
    Fire: '🔥',
    Rainbow: '🌈',
    Star: '⭐',
    Moon: '🌙'
  }
};

// Keys are PascalCase identifiers; split into words for display ("IceCream"
// -> "Ice Cream"), then kebab for ids/urls ("ice-cream").
const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2');

const slug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

// Prices are rolled once, at module load, from a fixed range - so they stay
// stable while you browse but differ run-to-run.
const roll = () => Math.round((2 + Math.random() * 48) * 100) / 100;

export const categories: Category[] = Object.keys(INVENTORY).map((key) => ({
  slug: slug(key),
  label: label(key)
}));

export const products: Product[] = Object.entries(INVENTORY).flatMap(
  ([category, items]) =>
    Object.entries(items).map(([key, emoji]) => {
      const name = label(key);

      return {
        id: slug(name),
        emoji,
        name,
        category: slug(category),
        price: roll()
      };
    })
);

const byId = new Map(products.map((p) => [p.id, p]));

export const getProduct = (id: string) => byId.get(id);

export const inCategory = (cat: string) =>
  products.filter((p) => p.category === cat);

export const categoryLabel = (cat: string) => {
  const found = categories.find((c) => c.slug === cat);
  return found ? found.label : cat;
};

export const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
