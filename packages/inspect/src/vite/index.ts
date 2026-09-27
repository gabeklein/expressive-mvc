import type { Plugin } from 'vite';

import { plugin } from './plugin';

export default function inspect(): Plugin {
  return plugin(import.meta.url);
}
