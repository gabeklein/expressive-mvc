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

const INVENTORY: Record<string, Record<string, [string, number]>> = {
  Food: {
    Pizza: ['🍕', 12.5],
    Burger: ['🍔', 9.75],
    Taco: ['🌮', 4.25],
    Sushi: ['🍣', 18],
    Donut: ['🍩', 2.5],
    IceCream: ['🍦', 3.75]
  },
  Animals: {
    Dog: ['🐶', 45],
    Cat: ['🐱', 42],
    Fox: ['🦊', 38.5],
    Panda: ['🐼', 49.99],
    Lion: ['🦁', 47],
    Penguin: ['🐧', 29.5]
  },
  Faces: {
    Grinning: ['😀', 5],
    Cool: ['😎', 7.5],
    Robot: ['🤖', 14.25],
    Ghost: ['👻', 6.66],
    Cowboy: ['🤠', 11],
    Party: ['🥳', 8.5]
  },
  Nature: {
    Cactus: ['🌵', 16],
    Wave: ['🌊', 22.5],
    Fire: ['🔥', 13.75],
    Rainbow: ['🌈', 24],
    Star: ['⭐', 19.99],
    Moon: ['🌙', 21]
  }
};

const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2');

const slug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

export const categories: Category[] = Object.keys(INVENTORY).map((key) => ({
  slug: slug(key),
  label: label(key)
}));

export const products: Product[] = Object.entries(INVENTORY).flatMap(
  ([category, items]) =>
    Object.entries(items).map(([key, [emoji, price]]) => {
      const name = label(key);

      return {
        id: slug(name),
        emoji,
        name,
        category: slug(category),
        price
      };
    })
);

const byId = new Map(products.map((p) => [p.id, p]));

export const getProduct = (id: string) => byId.get(id);

export const inCategory = (cat: string) =>
  products.filter((p) => p.category === cat);

export const categoryLabel = (cat: string) =>
  categories.find((c) => c.slug === cat)?.label ?? cat;

export const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
