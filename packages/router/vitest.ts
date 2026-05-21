import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

export * from 'vitest';
export { act, render, screen } from '@testing-library/react';
export { mockError, mockPromise, mockWarn } from '../../vitest.setup';
