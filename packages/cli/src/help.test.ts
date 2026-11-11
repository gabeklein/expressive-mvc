import { Model } from '@expressive/mvc';
import { expect, it } from 'vitest';

import { help, usage } from './help';
import { arg, args, flag, list, opt, SPECS } from './input';

const specs = (Type: Model.Type) => SPECS.get(Type.new())!;

it('will list operands and options', () => {
  class Lint extends Model {
    config = arg({ required: true, help: 'rules to apply' });
    target = arg();
    files = args({ min: 1, help: 'files to check' });
    fix = flag({ short: 'f', help: 'rewrite in place' });
    port = opt({ short: 'p', default: 3000, help: 'listen port' });
    level = opt({ default: 'info' });
    size = opt({ type: 'number' });
    tags = list({ default: [] });
    keep = list({ default: [1] });
  }

  expect(help('lint', specs(Lint))).toBe(
    [
      'Usage: lint [options] <config> [target] <files...>',
      '',
      'Arguments:',
      '  <config>    rules to apply',
      '  [target]',
      '  <files...>  files to check',
      '',
      'Options:',
      '  -f, --fix            rewrite in place',
      '  -p, --port <number>  listen port (default: 3000)',
      '  --level <value>      (default: info)',
      '  --size <number>',
      '  --tags <value>',
      '  --keep <number>      (default: 1)',
      '  -h, --help           show this help'
    ].join('\n')
  );
});

it('will show optional rest operands in brackets', () => {
  class Test extends Model {
    files = args();
  }

  expect(usage('test', specs(Test))).toBe('Usage: test [options] [files...]');
});

it('will list only help when nothing is declared', () => {
  class Test extends Model {}

  expect(help('test', specs(Test) || [])).toBe('Usage: test [options]\n\nOptions:\n  -h, --help  show this help');
});
