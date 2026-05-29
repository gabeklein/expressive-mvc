// No DOM preload - @expressive/component is renderer-agnostic and its tests
// exercise neutral logic (reconciliation, subcomponent discovery), not rendering.
// Reuses the core package's custom matchers + helpers.
import '../state/test.setup';

export { mockError, mockPromise, mockWarn } from '../state/test.setup';
