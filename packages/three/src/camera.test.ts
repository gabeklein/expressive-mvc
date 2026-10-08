import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { fit, OrthographicCamera, PerspectiveCamera } from './camera';
import { Mesh } from './object';
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

describe('OrthographicCamera', () => {
  it('will update projection as a member changes', async () => {
    const camera = OrthographicCamera.new();
    const before = (objectOf(camera) as THREE.OrthographicCamera).projectionMatrix.clone();

    camera.zoom = 2;

    expect((objectOf(camera) as THREE.OrthographicCamera).projectionMatrix.equals(before)).toBe(false);
    await expect(camera).toHaveUpdated('zoom');
  });
});

describe('fit', () => {
  it('will set a perspective camera\'s aspect', () => {
    const camera = PerspectiveCamera.new();

    fit(camera, 800, 400);

    expect(camera.aspect).toBe(2);
  });

  it('will keep an orthographic camera\'s height and center, fitting its width', () => {
    class Side extends OrthographicCamera {
      left = 0;
      right = 4;
      top = 1;
      bottom = -1;
    }

    const camera = Side.new();

    fit(camera, 300, 100);

    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-1, 5, 1, -1]);
  });

  it('will leave a camera alone at zero height, or one it cannot fit', () => {
    const camera = PerspectiveCamera.new();
    const mesh = Mesh.new();

    fit(camera, 100, 0);
    fit(mesh, 100, 50);

    expect(camera.aspect).toBe(1);
  });
});
