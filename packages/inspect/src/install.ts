import { attach, inspect, journal, type Options } from './index';

const preset = globalThis.__EXPRESSIVE_INSPECT__ as { record?: Options } | undefined;

attach();

if (preset?.record) journal.record(preset.record);

globalThis.__EXPRESSIVE_INSPECT__ = inspect;
