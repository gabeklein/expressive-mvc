import { describe, expect, it } from 'vitest';

import * as api from './index';

describe('public surface', () => {
  it('will export scene entries alongside re-exported mvc', () => {
    expect(Object.keys(api).sort()).toEqual([
      'Component',
      'Context',
      'Frame',
      'Group',
      'Mesh',
      'Object3D',
      'State',
      'def',
      'default',
      'get',
      'has',
      'loop',
      'map',
      'ref',
      'render',
      'set'
    ]);
  });
});
