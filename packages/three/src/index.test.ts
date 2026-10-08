import { describe, expect, it } from 'vitest';

import * as api from './index';

describe('public surface', () => {
  it('will export scene entries alongside re-exported mvc', () => {
    expect(Object.keys(api).sort()).toEqual([
      'AmbientLight',
      'Context',
      'DirectionalLight',
      'Frame',
      'Group',
      'HemisphereLight',
      'Light',
      'Mesh',
      'Object3D',
      'OrthographicCamera',
      'PerspectiveCamera',
      'PointLight',
      'Scene',
      'SpotLight',
      'State',
      'Viewport',
      'def',
      'default',
      'get',
      'has',
      'loop',
      'map',
      'ref',
      'set'
    ]);
  });
});
