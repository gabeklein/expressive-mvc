import Model from '@expressive/mvc';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { sentinel } from './sentinel';
import { Source } from './source';

const observers: { callback: IntersectionObserverCallback; options?: IntersectionObserverInit; observe: any; disconnect: any }[] = [];

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();

      constructor(
        public callback: IntersectionObserverCallback,
        public options?: IntersectionObserverInit
      ) {
        observers.push(this);
      }
    }
  );
});

afterEach(() => {
  observers.length = 0;
  vi.unstubAllGlobals();
});

class Pages extends Source<number> {
  query = vi.fn(async () => []);
}

class List extends Model {
  source = new Pages();
  trailer = sentinel(this.source);
}

function intersect(...isIntersecting: boolean[]) {
  const [{ callback }] = observers;
  callback(isIntersecting.map((x) => ({ isIntersecting: x })) as any, {} as any);
}

it('will observe bound element with margin', () => {
  const list = List.new();
  const element = document.createElement('div');

  list.trailer(element);

  const [observer] = observers;

  expect(observer.observe).toHaveBeenCalledWith(element);
  expect(observer.options).toEqual({ rootMargin: '0px 0px 200px 0px' });
});

it('will accept a custom margin', () => {
  class Custom extends Model {
    trailer = sentinel(new Pages(), 50);
  }

  Custom.new().trailer(document.createElement('div'));

  expect(observers[0].options).toEqual({ rootMargin: '0px 0px 50px 0px' });
});

it('will request more when intersecting', () => {
  const list = List.new();
  const { query } = list.source;

  list.trailer(document.createElement('div'));

  intersect(false);
  expect(query).not.toHaveBeenCalled();

  intersect(false, true);
  expect(query).toHaveBeenCalledTimes(1);
});

it('will disconnect when unbound', () => {
  const list = List.new();

  list.trailer(document.createElement('div'));
  list.trailer(null);

  expect(observers[0].disconnect).toHaveBeenCalled();
});
