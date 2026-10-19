import { describe, expect, it, vi } from 'vitest';

import { Overlay } from './overlay';

class Layer extends Overlay {}

function press(key: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

describe('open count', () => {
  it('will count mounted overlays', () => {
    const start = Overlay.open;
    const a = Layer.new();
    const b = Layer.new();

    expect(Overlay.open).toBe(start + 2);

    a.set(null);
    b.set(null);

    expect(Overlay.open).toBe(start);
  });
});

describe('escape', () => {
  it('will close on Escape', () => {
    const onClose = vi.fn();
    const layer = Layer.new({ onClose });

    press('Enter');
    expect(onClose).not.toHaveBeenCalled();

    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);

    layer.set(null);
  });

  it('will stop listening when destroyed', () => {
    const onClose = vi.fn();

    Layer.new({ onClose }).set(null);
    press('Escape');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('will not bind when disabled', () => {
    const onClose = vi.fn();
    const layer = Layer.new({ onClose, escapeKey: false });

    press('Escape');
    expect(onClose).not.toHaveBeenCalled();

    layer.set(null);
  });
});

describe('backdrop', () => {
  function mount(props: Partial<Layer> = {}) {
    const onClose = vi.fn();
    const layer = Layer.new({ onClose, ...props });
    const element = document.createElement('div');
    const child = document.createElement('span');

    element.appendChild(child);
    layer.backdrop(element);

    const fire = (type: string, target: Element) =>
      target.dispatchEvent(new MouseEvent(type, { bubbles: true }));

    return { layer, element, child, onClose, fire };
  }

  it('will close when pressed', () => {
    const { element, onClose, fire } = mount();

    fire('mousedown', element);
    fire('click', element);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('will not close for a drag ending on backdrop', () => {
    const { element, child, onClose, fire } = mount();

    fire('mousedown', child);
    fire('click', element);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('will not close for a click on content', () => {
    const { element, child, onClose, fire } = mount();

    fire('mousedown', element);
    fire('click', child);
    fire('click', element);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('will not close when disabled', () => {
    const { element, onClose, fire } = mount({ backdropClose: false });

    fire('mousedown', element);
    fire('click', element);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('will unbind when released', () => {
    const { layer, element, onClose, fire } = mount();

    layer.backdrop(null);
    fire('mousedown', element);
    fire('click', element);

    expect(onClose).not.toHaveBeenCalled();
  });
});

it('will not throw on close without handler', () => {
  const layer = Layer.new();

  expect(() => layer.close()).not.toThrow();

  layer.set(null);
});
