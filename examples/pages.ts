import { ComponentType } from 'react';

import structure, { leaves, type GroupModule } from './structure';

const BASE = './pages/';

const manifests = import.meta.glob<GroupModule>('./pages/**/index.ts', { eager: true });
const apps = import.meta.glob<{ default: ComponentType }>('./pages/*/**/App.tsx');

const strip = (key: string) =>
  (key.startsWith(BASE) ? key.slice(BASE.length) : key).replace(/\/?index\.ts$/, '');

export const tree = structure(
  Object.fromEntries(Object.entries(manifests).map(([k, m]) => [strip(k), m]))
);

// Each leaf's lazy App.tsx module key doubles as its iframe src.
for (const leaf of leaves(tree)) {
  const file = `${BASE}${leaf.path}/App.tsx`;
  if (file in apps) leaf.file = file;
}

export const frameSrc = (file: string) => `module#${encodeURIComponent(file)}`;

export const loadFrame = () => apps[decodeURIComponent(location.hash.slice(1))];
