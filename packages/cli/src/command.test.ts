import { get, Model } from '@expressive/mvc';
import { Steps } from '@expressive/steps';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { command } from './command';
import { arg, args, flag, opt, sub } from './input';

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
  const created = vi.fn();
  const destroyed = vi.fn();

  class Test extends Model {
    new() {
      created();
      return destroyed;
    }

    run() {}
  }

  await command(Test)([], out);
  expect(destroyed).toHaveBeenCalledTimes(1);

  await command(Test)(['--nope'], out);
  expect(created).toHaveBeenCalledTimes(1);
});

it('will fail for a class without run', async () => {
  class Test extends Model {}

  expect(await command(Test)([], out)).toBe(1);
  expect(lines).toEqual(['! Test has no run() method.']);
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

describe('sub', () => {
  class Sync extends Model {
    entry = arg({ required: true });
    force = flag({ help: 'rebuild drifted columns' });

    run() {
      lines.push(`sync ${this.entry} force=${this.force}`);
    }
  }

  class Sql extends Model {
    entry = arg({ required: true });

    check = sub({
      help: 'list what sync would change',
      run: () => void lines.push(`check ${this.entry}`)
    });

    sync = sub(Sync, { help: 'apply schema changes' });
  }

  it('will route to a class sub', async () => {
    expect(await command(Sql)(['sync', 'db.ts', '--force'], out)).toBe(0);
    expect(lines).toEqual(['sync db.ts force=true']);
  });

  it('will run an inline sub with the parent inputs', async () => {
    expect(await command(Sql)(['check', 'db.ts'], out)).toBe(0);
    expect(lines).toEqual(['check db.ts']);
  });

  it('will refuse an option before its owner', async () => {
    expect(await command(Sql)(['--force', 'sync', 'db.ts'], out)).toBe(2);
    expect(lines).toEqual(['! Unknown option --force.\nUsage: sql [options] <command> <entry>']);
  });

  it('will refuse an option of another sub', async () => {
    expect(await command(Sql)(['check', 'db.ts', '--force'], out)).toBe(2);
    expect(lines).toEqual(['! Unknown option --force.\nUsage: sql check [options] <entry>']);
  });

  it('will print help for a group run alone, and return 2', async () => {
    expect(await command(Sql)([], out)).toBe(2);
    expect(lines[0]).toMatch(
      /^! Usage: sql \[options\] <command> <entry>\n\nArguments:\n {2}<entry>\n\nCommands:\n {2}check {2}list what sync would change\n {2}sync {3}apply schema changes/
    );
  });

  it('will print help for the routed path', async () => {
    expect(await command(Sql)(['sync', '--help'], out)).toBe(0);
    expect(lines[0]).toMatch(/^Usage: sql sync \[options\] <entry>\n[^]*--force +rebuild drifted columns/);
  });

  it('will fail on an unknown command', async () => {
    class Group extends Model {
      sync = sub(Sync);
    }

    expect(await command(Group)(['nope'], out)).toBe(2);
    expect(lines).toEqual(['! Unknown command "nope".\nUsage: group [options] <command>']);
  });

  it('will fill args once routing ends', async () => {
    class Test extends Model {
      name = arg();
      sync = sub(Sync);

      run() {
        lines.push(`run ${this.name} ${this.sync}`);
      }
    }

    await command(Test)(['other'], out);
    await command(Test)(['--', 'sync'], out);
    await command(Test)([], out);

    expect(lines).toEqual(['run other undefined', 'run sync undefined', 'run undefined undefined']);
  });

  it('will float options over the path, filled before any new()', async () => {
    const seen: string[] = [];

    class Leaf extends Model {
      root = get(Root);
      deep = flag();

      new() {
        seen.push(`leaf new: entry=${this.root.entry} deep=${this.deep}`);
      }

      run() {
        lines.push(`leaf ${this.root.entry} ${this.root.middle?.depth}`);
      }
    }

    class Middle extends Model {
      depth = opt({ type: 'number' });
      leaf = sub(Leaf);

      new() {
        seen.push(`middle new: depth=${this.depth}`);
      }
    }

    class Root extends Model {
      entry = opt();
      middle = sub(Middle);

      new() {
        seen.push(`root new: middle=${!!this.middle}`);
      }
    }

    expect(await command(Root)(['middle', 'leaf', '--entry', 'x', '--deep', '--depth', '2'], out)).toBe(0);
    expect(lines).toEqual(['leaf x 2']);
    expect(seen).toEqual(['leaf new: entry=x deep=true', 'middle new: depth=2', 'root new: middle=true']);
  });

  it('will share an option declared at several levels', async () => {
    class Child extends Model {
      force = flag();
      level = opt({ default: 'child' });

      run() {
        lines.push(`child ${this.force} ${this.level}`);
      }
    }

    class Parent extends Model {
      force = flag({ short: 'f' });
      level = opt({ default: 'parent' });
      child = sub(Child);

      run() {}

      new() {
        return () => lines.push(`parent ${this.force} ${this.level}`);
      }
    }

    await command(Parent)(['child'], out);
    await command(Parent)(['child', '-f', '--level', 'x'], out);

    expect(lines).toEqual(['child false child', 'parent false parent', 'child true x', 'parent true x']);
  });

  it('will fail a shared option declared differently', async () => {
    class Child extends Model {
      port = opt();

      run() {}
    }

    class Parent extends Model {
      port = opt({ type: 'number' });
      child = sub(Child);
    }

    expect(await command(Parent)(['child'], out)).toBe(1);
    expect(lines).toEqual(['! --port is declared differently by Parent and Child.']);
  });

  it('will fail a short claimed twice', async () => {
    class Child extends Model {
      fix = flag({ short: 'f' });

      run() {}
    }

    class Parent extends Model {
      force = flag({ short: 'f' });
      child = sub(Child);
    }

    expect(await command(Parent)(['child'], out)).toBe(1);
    expect(lines).toEqual(['! -f is declared by both --force and --fix.']);
  });

  it('will destroy the path, child first', async () => {
    class Child extends Model {
      new() {
        return () => lines.push('child destroyed');
      }

      run() {}
    }

    class Parent extends Model {
      child = sub(Child);

      new() {
        return () => lines.push('parent destroyed');
      }
    }

    await command(Parent)(['child'], out);

    expect(lines).toEqual(['child destroyed', 'parent destroyed']);
  });

  it('will tear down field children when the build aborts', async () => {
    let loads = 0;

    class Logger extends Model {
      new() {
        lines.push('logger new');
        return () => lines.push('logger destroyed');
      }
    }

    class Late extends Model {
      logger = new Logger();

      run() {}
    }

    class Test extends Model {
      logger = new Logger();
      late = sub(async () => (loads++, Late));
    }

    expect(await command(Test)(['--nope'], out)).toBe(2);
    expect(lines.splice(0)).toEqual(['logger new', 'logger destroyed', '! Unknown option --nope.\nUsage: test [options] <command>']);

    expect(await command(Test)(['late'], out)).toBe(0);
    expect(lines).toEqual([
      'logger new',
      'logger destroyed',
      'logger new',
      'logger new',
      'logger destroyed',
      'logger destroyed'
    ]);

    expect(loads).toBe(1);
  });

  it('will load a lazy sub once, when routed', async () => {
    const created = vi.fn();

    class Late extends Model {
      run() {
        lines.push('late');
      }
    }

    const load = vi.fn(async () => ({ default: Late }));
    const bare = vi.fn(async () => Late);

    class Test extends Model {
      late = sub(load);
      bare = sub(bare);

      new() {
        created();
      }

      run() {}
    }

    const run = command(Test);

    await run([], out);
    expect(load).not.toHaveBeenCalled();

    await run(['late'], out);
    await run(['late'], out);
    await run(['bare'], out);

    expect(load).toHaveBeenCalledTimes(1);
    expect(bare).toHaveBeenCalledTimes(1);
    expect(created).toHaveBeenCalledTimes(4);
    expect(lines).toEqual(['late', 'late', 'late']);
  });

  it('will fail when a lazy sub does not load', async () => {
    class Test extends Model {
      late = sub(async () => {
        throw new Error('not found');
      });
    }

    expect(await command(Test)(['late'], out)).toBe(1);
    expect(lines).toEqual(['! not found']);
  });

  it('will fail a sub with no run', async () => {
    class Empty extends Model {}

    class Test extends Model {
      empty = sub(Empty);
    }

    expect(await command(Test)(['empty'], out)).toBe(1);
    expect(lines).toEqual(['! Empty has no run() method.']);
  });
});
