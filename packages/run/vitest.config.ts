import { mergeConfig } from 'vitest/config';
import { suite } from '../../vitest.config';

export default mergeConfig(suite(), {
  test: { include: ['examples/**/*.test.*'] }
});
