import { attach, inspect } from './index';

attach();

(globalThis as typeof globalThis & { __EXPRESSIVE_INSPECT__?: typeof inspect }).__EXPRESSIVE_INSPECT__ = inspect;
