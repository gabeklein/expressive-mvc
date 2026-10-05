import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { PerspectiveCamera } from './camera';
import { objectOf } from './object';

const cameraOf = (self: object) => objectOf(self) as THREE.PerspectiveCamera;

describe('PerspectiveCamera', () => {
  it('will update projection as a member changes', async () => {
    const camera = PerspectiveCamera.new();
    const before = cameraOf(camera).projectionMatrix.clone();

    camera.fov = 30;

    expect(cameraOf(camera).fov).toBe(30);
    expect(cameraOf(camera).projectionMatrix.equals(before)).toBe(false);
    await expect(camera).toHaveUpdated('fov');
  });

  it('will project from subclass defaults', () => {
    class Narrow extends PerspectiveCamera {
      fov = 20;
      near = 1;
    }

    const narrow = Narrow.new();
    const expected = new THREE.PerspectiveCamera(20, 1, 1, 2000);

    expect(cameraOf(narrow).projectionMatrix.equals(expected.projectionMatrix)).toBe(true);
  });
});
