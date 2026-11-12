import { Model } from '@expressive/mvc';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { arg, args, flag, list, opt, SPECS, sub } from './input';

describe('fields', () => {
  it('will start at defaults', () => {
    class Test extends Model {
      entry = arg();
      port = opt({ default: 3000 });
      force = flag();
      on = flag({ default: true });
      files = args();
      tags = list({ default: ['a'] });
    }

    const test = Test.new();

    expect(test.entry).toBeUndefined();
    expect(test.port).toBe(3000);
    expect(test.force).toBe(false);
    expect(test.on).toBe(true);
    expect(test.files).toEqual([]);
    expect(test.tags).toEqual(['a']);
  });

  it('will not share a default list between instances', () => {
    class Test extends Model {
      tags = list({ default: ['a'] });
    }

    const one = Test.new();
    const two = Test.new();

    one.tags.push('b');

    expect(two.tags).toEqual(['a']);
  });

  it('will accept values without argv', () => {
    class Test extends Model {
      entry = arg({ required: true });
      force = flag();
    }

    const test = Test.new({ entry: 'x.ts', force: true });

    expect(test.entry).toBe('x.ts');
    expect(test.force).toBe(true);
  });

  it('will record inputs in declaration order', () => {
    class Base extends Model {
      config = arg();
    }

    class Test extends Base {
      force = flag();
      files = args();
    }

    const specs = SPECS.get(Test.new())!;

    expect(specs.map((spec) => [spec.key, spec.kind])).toEqual([
      ['config', 'arg'],
      ['force', 'flag'],
      ['files', 'args']
    ]);
  });

  it('will merge configs left to right', () => {
    const source = { type: 'file', ext: ['.ts'] } as const;

    class Test extends Model {
      entry = opt(source, { short: 'e', ext: ['.js'] });
    }

    const [spec] = SPECS.get(Test.new())!;

    expect(spec.config).toEqual({ type: 'file', short: 'e', ext: ['.js'] });
  });
});

describe('types', () => {
  it('will type single values', () => {
    class Test extends Model {
      entry = arg();
      required = arg({ required: true });
      port = opt({ type: 'number' });
      fallback = opt({ default: 3000 });
      named = opt({ default: 'info' });
      parsed = opt({ parse: (value) => new Date(value), required: true });
      force = flag();
    }

    const test = Test.new();

    expectTypeOf(test.entry).toEqualTypeOf<string | undefined>();
    expectTypeOf(test.required).toEqualTypeOf<string>();
    expectTypeOf(test.port).toEqualTypeOf<number | undefined>();
    expectTypeOf(test.fallback).toEqualTypeOf<number>();
    expectTypeOf(test.named).toEqualTypeOf<string>();
    expectTypeOf(test.parsed).toEqualTypeOf<Date>();
    expectTypeOf(test.force).toEqualTypeOf<boolean>();
  });

  it('will type plural values', () => {
    class Test extends Model {
      files = args({ type: 'file' });
      ports = list({ type: 'number' });
      sizes = list({ default: [1] });
      dates = args({ parse: (value) => new Date(value) });
    }

    const test = Test.new();

    expectTypeOf(test.files).toEqualTypeOf<string[]>();
    expectTypeOf(test.ports).toEqualTypeOf<number[]>();
    expectTypeOf(test.sizes).toEqualTypeOf<number[]>();
    expectTypeOf(test.dates).toEqualTypeOf<Date[]>();
  });

  it('will type subs', () => {
    class Child extends Model {
      run() {}
    }

    class Statics extends Model {
      static help = 'leaked';
      static run() {}
    }

    class Test extends Model {
      statics = sub(Statics);
      child = sub(Child);
      lazy = sub(async () => ({ default: Child }));
      inline = sub({ run() {} });
    }

    const test = Test.new();

    expect(test.child).toBeUndefined();
    expectTypeOf(test.child).toEqualTypeOf<Child | undefined>();
    expectTypeOf(test.lazy).toEqualTypeOf<Child | undefined>();
    expectTypeOf(test.inline).toEqualTypeOf<true | undefined>();
    expectTypeOf(test.statics).toEqualTypeOf<Statics | undefined>();
    expect(SPECS.get(test)!.find((spec) => spec.key == 'statics')!.config.help).toBeUndefined();
  });
});
