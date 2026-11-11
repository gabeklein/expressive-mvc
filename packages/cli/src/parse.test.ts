import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Model } from '@expressive/mvc';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { arg, args, flag, list, opt, SPECS } from './input';
import { parse, Usage } from './parse';

let cwd: string;

beforeAll(() => {
  cwd = mkdtempSync(join(tmpdir(), 'expressive-cli-'));
  mkdirSync(join(cwd, 'src'));
  writeFileSync(join(cwd, 'db.ts'), '');
  writeFileSync(join(cwd, 'notes.md'), '');
});

afterAll(() => {
  rmSync(cwd, { recursive: true });
});

function read(Type: Model.Type, ...argv: string[]) {
  return parse(SPECS.get(Type.new())!, argv, cwd);
}

function fails(Type: Model.Type, ...argv: string[]) {
  try {
    read(Type, ...argv);
  } catch (error) {
    expect(error).toBeInstanceOf(Usage);
    return (error as Error).message;
  }

  throw new Error('Expected a usage error.');
}

describe('operands', () => {
  class Lint extends Model {
    config = arg({ required: true });
    target = arg();
    files = args();
  }

  it('will fill args in order, the rest to args', () => {
    expect(read(Lint, 'a', 'b', 'c', 'd')).toEqual({ config: 'a', target: 'b', files: ['c', 'd'] });
  });

  it('will leave optional args unset', () => {
    expect(read(Lint, 'a')).toEqual({ config: 'a', files: [] });
  });

  it('will fail on a missing required arg', () => {
    expect(fails(Lint)).toBe('Missing <config>.');
  });

  it('will fail on an extra operand', () => {
    class One extends Model {
      only = arg();
    }

    expect(fails(One, 'a', 'b')).toBe('Unexpected argument "b".');
  });

  it('will take operands after --, and a lone -', () => {
    expect(read(Lint, '--', '--fix', '-')).toEqual({ config: '--fix', target: '-', files: [] });
  });

  it('will keep an arg default when not given', () => {
    class Test extends Model {
      level = arg({ default: 'info', required: true });
    }

    expect(read(Test)).toEqual({});
  });

  it('will throw on a required arg after an optional one', () => {
    class Test extends Model {
      first = arg();
      second = arg({ required: true });
    }

    expect(() => read(Test)).toThrow('Required <second> cannot follow optional <first>.');
  });

  it('will throw on an arg after args', () => {
    class Test extends Model {
      files = args();
      last = arg();
    }

    expect(() => read(Test)).toThrow('<files> takes the remaining arguments - <last> cannot follow it.');
  });
});

describe('options', () => {
  class Serve extends Model {
    force = flag({ short: 'f' });
    verbose = flag({ short: 'v' });
    dryRun = flag();
    port = opt({ short: 'p', type: 'number' });
    host = opt();
    tags = list({ short: 't' });
  }

  it('will read long options', () => {
    expect(read(Serve, '--force', '--port', '80', '--host=x', '--dry-run')).toEqual({
      force: true,
      dryRun: true,
      port: 80,
      host: 'x',
      tags: []
    });
  });

  it('will negate a flag', () => {
    expect(read(Serve, '--force', '--no-force')).toEqual({ force: false, tags: [] });
  });

  it('will group short flags, closed by one taking a value', () => {
    expect(read(Serve, '-fv', '-p', '80')).toMatchObject({ force: true, verbose: true, port: 80 });
    expect(read(Serve, '-fvp', '80')).toMatchObject({ force: true, verbose: true, port: 80 });
    expect(read(Serve, '-fp80')).toMatchObject({ force: true, port: 80 });
  });

  it('will take the last of a repeated opt', () => {
    expect(read(Serve, '--host', 'a', '--host', 'b')).toMatchObject({ host: 'b' });
  });

  it('will collect a list', () => {
    expect(read(Serve, '--tags', 'a', '-t', 'b', '-tc')).toMatchObject({ tags: ['a', 'b', 'c'] });
  });

  it('will split a list when asked', () => {
    class Test extends Model {
      tags = list({ split: ',' });
    }

    expect(read(Test, '--tags', 'a, b,', '--tags', 'c')).toEqual({ tags: ['a', 'b', 'c'] });
  });

  it('will take a value starting with a dash', () => {
    expect(read(Serve, '--host', '-x')).toMatchObject({ host: '-x' });
  });

  it('will fail on unknown options', () => {
    expect(fails(Serve, '--nope')).toBe('Unknown option --nope.');
    expect(fails(Serve, '-x')).toBe('Unknown option -x.');
    expect(fails(Serve, '--no-host')).toBe('Unknown option --no-host.');
  });

  it('will fail on a flag given a value', () => {
    expect(fails(Serve, '--force=yes')).toBe('--force takes no value.');
    expect(fails(Serve, '--no-force=yes')).toBe('Unknown option --no-force.');
  });

  it('will fail on a missing value', () => {
    expect(fails(Serve, '--port')).toBe('--port needs a value.');
    expect(fails(Serve, '-p')).toBe('--port needs a value.');
  });

  it('will fail on a required opt not given', () => {
    class Test extends Model {
      name = opt({ required: true });
    }

    expect(fails(Test)).toBe('Missing --name.');
  });

  it('will interleave options with operands', () => {
    class Test extends Model {
      entry = arg();
      force = flag();
    }

    expect(read(Test, '--force', 'x')).toEqual({ entry: 'x', force: true });
    expect(read(Test, 'x', '--force')).toEqual({ entry: 'x', force: true });
  });
});

describe('help', () => {
  class Test extends Model {
    entry = arg({ required: true });
    port = opt({ type: 'number' });
  }

  it('will ask for help over other errors', () => {
    expect(read(Test, '--help')).toBe(true);
    expect(read(Test, '-h', '--port', 'x')).toBe(true);
  });

  it('will leave -h to a flag using it', () => {
    class Own extends Model {
      human = flag({ short: 'h' });
    }

    expect(read(Own, '-h')).toEqual({ human: true });
  });
});

describe('values', () => {
  it('will read numbers', () => {
    class Test extends Model {
      port = opt({ type: 'number' });
      size = opt({ default: 1 });
      sizes = list({ default: [1] });
    }

    expect(read(Test, '--port', '80', '--size', '2', '--sizes', '3')).toEqual({ port: 80, size: 2, sizes: [3] });
    expect(fails(Test, '--port', 'x')).toBe('--port: "x" is not a number.');
    expect(fails(Test, '--port', ' ')).toBe('--port: " " is not a number.');
  });

  it('will resolve paths against cwd', () => {
    class Test extends Model {
      entry = arg({ type: 'file', exists: true, ext: ['.ts'] });
      out = opt({ type: 'dir' });
    }

    expect(read(Test, 'db.ts', '--out', 'dist')).toEqual({ entry: join(cwd, 'db.ts'), out: join(cwd, 'dist') });
  });

  it('will check existence and kind', () => {
    class Test extends Model {
      file = opt({ type: 'file', exists: true });
      dir = opt({ type: 'dir', exists: true });
      path = opt({ type: 'path', exists: true });
    }

    expect(read(Test, '--path', 'src', '--dir', 'src', '--file', 'db.ts')).toMatchObject({ path: join(cwd, 'src') });
    expect(fails(Test, '--file', 'src')).toBe('--file: no such file "src".');
    expect(fails(Test, '--dir', 'db.ts')).toBe('--dir: no such dir "db.ts".');
    expect(fails(Test, '--path', 'nope')).toBe('--path: no such path "nope".');
  });

  it('will check extensions', () => {
    class Test extends Model {
      entry = arg({ type: 'path', ext: ['.ts', '.js'] });
      out = opt({ type: 'dir', ext: ['.ts'] });
    }

    expect(fails(Test, 'notes.md')).toBe('<entry>: "notes.md" must end in .ts, .js.');
    expect(read(Test, 'db.ts', '--out', 'src')).toEqual({ entry: join(cwd, 'db.ts'), out: join(cwd, 'src') });
  });

  it('will parse each value', () => {
    class Test extends Model {
      when = opt({ parse: (value) => new Date(value) });
      dates = args({ parse: (value) => value.length });
      path = opt({ type: 'path', parse: (value) => value.length });
    }

    expect(read(Test, '--when', '2020-01-01', 'ab', 'abc')).toEqual({
      when: new Date('2020-01-01'),
      dates: [2, 3]
    });

    expect(read(Test, '--path', 'x')).toMatchObject({ path: join(cwd, 'x').length });
  });

  it('will fail when parse throws', () => {
    class Test extends Model {
      level = opt({
        parse: (value) => {
          if (value == 'loud') throw new Error('not a level');
          throw 'nope';
        }
      });
    }

    expect(fails(Test, '--level', 'loud')).toBe('--level: not a level');
    expect(fails(Test, '--level', 'x')).toBe('--level: nope');
  });

  it('will validate each value', () => {
    class Test extends Model {
      port = opt({ type: 'number', valid: (value) => value > 0 });
      tags = list({ valid: (value) => value != 'x' });
    }

    expect(read(Test, '--port', '1', '--tags', 'a')).toEqual({ port: 1, tags: ['a'] });
    expect(fails(Test, '--port', '0')).toBe('--port: invalid value "0".');
    expect(fails(Test, '--tags', 'a', '--tags', 'x')).toBe('--tags: invalid value "x".');
  });
});

describe('counts', () => {
  class Test extends Model {
    files = args({ min: 1, max: 2 });
    tags = list({ min: 2 });
    one = list({ max: 1 });
    keep = list({ default: ['a'], min: 3 });
  }

  it('will bound plural counts', () => {
    expect(read(Test, 'a', '--tags', 'x', '--tags', 'y')).toEqual({ files: ['a'], tags: ['x', 'y'], one: [] });
    expect(fails(Test, '--tags', 'x', '--tags', 'y')).toBe('<files> needs at least 1 value.');
    expect(fails(Test, 'a', 'b', 'c')).toBe('<files> takes at most 2 values.');
    expect(fails(Test, 'a', '--tags', 'x')).toBe('--tags needs at least 2 values.');
    expect(fails(Test, 'a', '--tags', 'x', '--tags', 'y', '--one', '1', '--one', '2')).toBe(
      '--one takes at most 1 value.'
    );
  });
});
