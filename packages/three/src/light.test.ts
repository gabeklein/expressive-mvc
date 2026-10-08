import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { AmbientLight, DirectionalLight, HemisphereLight, PointLight, SpotLight } from './light';
import { objectOf, Scene } from './object';

describe('Light', () => {
  it('will read live color and write intensity through', async () => {
    const light = AmbientLight.new();

    light.intensity = 2;

    expect(light.color).toBe((objectOf(light) as THREE.AmbientLight).color);
    expect((objectOf(light) as THREE.AmbientLight).intensity).toBe(2);
    await expect(light).toHaveUpdated('intensity');
  });

  it('will copy an assigned color and dispatch, but not when mutated in place', async () => {
    const light = PointLight.new();
    const { color } = light;

    light.color = new THREE.Color('red');

    expect(light.color).toBe(color);
    expect(color.getHexString()).toBe('ff0000');
    await expect(light).toHaveUpdated('color');

    light.color.setHex(0x00ff00);

    await expect(light).not.toHaveUpdated();
  });

  it('will route subclass defaults to the object', () => {
    class Sun extends DirectionalLight {
      color = new THREE.Color(0xffeedd);
      intensity = 3;
    }

    class Sky extends HemisphereLight {
      groundColor = new THREE.Color(0x332211);
    }

    class Lamp extends SpotLight {
      angle = Math.PI / 8;
      penumbra = 0.5;
      distance = 10;
      decay = 1;
    }

    const sun = objectOf(Sun.new()) as THREE.DirectionalLight;
    const sky = objectOf(Sky.new()) as THREE.HemisphereLight;
    const lamp = objectOf(Lamp.new()) as THREE.SpotLight;

    expect(sun.color.getHex()).toBe(0xffeedd);
    expect(sun.intensity).toBe(3);
    expect(sky.groundColor.getHex()).toBe(0x332211);
    expect([lamp.angle, lamp.penumbra, lamp.distance, lamp.decay]).toEqual([Math.PI / 8, 0.5, 10, 1]);
  });

  it('will join the scene like any node', () => {
    class Lit extends Scene {
      sun = new DirectionalLight();
      bulb = new PointLight({ distance: 5 });
    }

    const lit = Lit.new();

    expect(objectOf(lit).children).toEqual([objectOf(lit.sun), objectOf(lit.bulb)]);
    expect((objectOf(lit.bulb) as THREE.PointLight).distance).toBe(5);
  });
});
