import { attach, inspect } from './index';

attach();

globalThis.__EXPRESSIVE_INSPECT__ = inspect;
