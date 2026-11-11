import { Model } from '@expressive/mvc';
import { Steps } from '@expressive/steps';
import { beforeEach, expect, it, vi } from 'vitest';

import { command } from './command';
import { arg, args, flag, opt } from './input';

let lines: string[];

const out = {
  log: (line: unknown) => void lines.push(String(line)),
  error: (line: unknown) => void lines.push('! ' + line)
};

beforeEach(() => {
  lines = [];
});

class Lint extends Model {
  config = arg({ required: true, help: 'rules to apply' });
  files = args({ min: 1 });
  fix = flag({ short: 'f' });
  level = opt({ default: 'warn' });

  run() {
    lines.push(`${this.config} ${this.files.join(' ')} fix=${this.fix} level=${this.level}`);
  }
}

it('will run with values from argv', async () => {
  expect(await command(Lint)(['rules', 'a.ts', 'b.ts', '-f', '--level=error'], out)).toBe(0);
  expect(lines).toEqual(['rules a.ts b.ts fix=true level=error']);
});

it('will fill fields before new()', async () => {
  class Test extends Model {
    name = opt();
    seen?: string;

    new() {
      this.seen = this.name;
    }

    run() {
      return this.seen;
    }
  }

  expect(await command(Test)(['--name', 'x'], out)).toBe(0);
  expect(lines).toEqual(['x']);
});

it('will print usage and return 2 on bad input', async () => {
  expect(await command(Lint)(['rules'], out)).toBe(2);
  expect(lines).toEqual(['! <files> needs at least 1 value.\nUsage: lint [options] <config> <files...>']);
});

it('will print help and return 0', async () => {
  expect(await command(Lint)(['--help'], out)).toBe(0);
  expect(lines[0]).toMatch(/^Usage: lint \[options\] <config> <files\.\.\.>\n\nArguments:\n {2}<config> {4}rules to apply/);
});

it('will name the command from its class', async () => {
  class SqlSync extends Model {
    run() {}
  }

  await command(SqlSync)(['-h'], out);

  expect(lines[0]).toMatch(/^Usage: sql-sync \[options\]/);
});

it('will map results to exit codes', async () => {
  const returns = (value: unknown) =>
    class Test extends Model {
      run() {
        return value;
      }
    };

  expect(await command(returns(undefined))([], out)).toBe(0);
  expect(await command(returns(true))([], out)).toBe(0);
  expect(await command(returns(false))([], out)).toBe(1);
  expect(await command(returns(7))([], out)).toBe(7);
  expect(await command(returns(Promise.resolve(3)))([], out)).toBe(3);
  expect(await command(returns('done'))([], out)).toBe(0);
  expect(lines).toEqual(['done']);
});

it('will print a throw and return 1', async () => {
  class Test extends Model {
    async run() {
      throw new Error('broke');
    }
  }

  class Odd extends Model {
    run() {
      throw 'odd';
    }
  }

  expect(await command(Test)([], out)).toBe(1);
  expect(await command(Odd)([], out)).toBe(1);
  expect(lines).toEqual(['! broke', '! odd']);
});

it('will report inputs declared in an unfillable order', async () => {
  class Test extends Model {
    files = args();
    last = arg();

    run() {}
  }

  expect(await command(Test)([], out)).toBe(1);
  expect(lines).toEqual(['! <files> takes the remaining arguments - <last> cannot follow it.']);
});

it('will destroy the instance after', async () => {
  const destroyed = vi.fn();

  class Test extends Model {
    new() {
      return destroyed;
    }

    run() {}
  }

  await command(Test)([], out);
  expect(destroyed).toHaveBeenCalledTimes(1);

  await command(Test)(['--nope'], out);
  expect(destroyed).toHaveBeenCalledTimes(2);
});

it('will throw for a class without run', () => {
  class Test extends Model {}

  expect(() => command(Test as any)).toThrow('Test has no run() method.');
});

it('will run a Steps class', async () => {
  class Deploy extends Steps {
    version = arg({ required: true });
    hosts: string[] = [];

    async run() {
      this.build();
      this.release();

      await this;

      return this.hosts.length;
    }

    build() {
      this.hosts = ['a', 'b'];
    }

    release() {
      lines.push(`released ${this.version} to ${this.hosts.join(', ')}`);
    }
  }

  expect(await command(Deploy)(['1.4.0'], out)).toBe(2);
  expect(lines).toEqual(['released 1.4.0 to a, b']);
});
