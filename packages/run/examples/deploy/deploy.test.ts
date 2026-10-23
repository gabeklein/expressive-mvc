import { afterEach, expect, it, vi } from 'vitest';

import { journal, mockWarn, record } from '../../test.setup';
import { Deploy } from './deploy';
import { chat, ci, db, delay, fleet, git, MINUTE, pager, registry, SECOND } from './services';

const HOSTS = ['web-1', 'web-2', 'web-3', 'web-4', 'web-5'];

// a subclass keeping each entry its after hook is handed - read with record(deploy)
const Logged = journal(Deploy);

const create = () => {
  const deploy = Logged.new({ version: '1.2.0', hosts: HOSTS });

  deploy.releases.add({ version: '1.0.0' });
  deploy.releases.add({ version: '1.1.0' });

  return deploy;
};

const untilGate = (deploy: Deploy) => vi.waitFor(() => expect(deploy.promote).toBeDefined());

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('will release through the gate', async () => {
  vi.spyOn(fleet, 'drain');
  vi.spyOn(fleet, 'serve');

  const deploy = create();
  const release = deploy.next();

  await untilGate(deploy);

  // the canaries are live while the gate waits
  expect([...deploy.live.keys()].sort()).toEqual(['web-1', 'web-4']);
  expect(deploy.then.status).toBe('waiting');
  expect(deploy.then.waiting).toEqual([{ id: 'wait#1', step: 'gate', args: [], answers: ['promote', 'abort'] }]);

  await deploy.promote('gabe');

  expect(await release).toEqual({
    version: '1.2.0',
    hosts: expect.arrayContaining(HOSTS),
    approver: 'gabe'
  });
  expect(deploy.promote).toBeUndefined();
  expect(deploy.report).toBe('1.2.0 live on 5 hosts');
  expect(deploy.releases.map((release) => release.version)).toEqual(['1.1.0', '1.2.0']);
  expect(fleet.drain).toHaveBeenCalledTimes(3);
  expect(fleet.serve).toHaveBeenCalledTimes(3);
  expect(record(deploy).map((entry) => entry.key)).toEqual([
    'next',
    'build',
    'test',
    'suite',
    'canary',
    'install',
    'install',
    'gate',
    'promote',
    'migrate',
    'rollout',
    'upgrade',
    'upgrade',
    'upgrade',
    'retire',
    'announce',
    'end'
  ]);
});

it('will log every step through before and after', async () => {
  const deploy = create();
  const release = deploy.next();

  await untilGate(deploy);
  await deploy.promote('gabe');
  await release;

  expect(deploy.log.get(0, 6)).toEqual(['next()', 'next#1 ok', 'build()', 'build#1 ok', 'test()', 'test#1 ok']);
  expect(deploy.log.get((line) => line.startsWith('promote'))).toBe('promote(gabe)');
  // hooks write outside any entry
  expect(record(deploy).some((entry) => entry.wrote.includes('log'))).toBe(false);
});

it('will retry a flaky test suite with backoff', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  const test = vi.spyOn(ci, 'test').mockRejectedValueOnce(new Error('flaky')).mockRejectedValueOnce(new Error('flaky'));
  const deploy = create();

  deploy.next();

  await vi.advanceTimersByTimeAsync(SECOND - 1);
  expect(test).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(1);
  expect(test).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(2 * SECOND);
  expect(test).toHaveBeenCalledTimes(3);

  // a failed suite never commits; each re-run of test carries its retry count
  const tries = record(deploy).filter((entry) => entry.key == 'test' || entry.key == 'suite');

  expect(tries.map((entry) => [entry.id, entry.retry])).toEqual([
    ['test#1', undefined],
    ['test#2', 1],
    ['test#3', 2],
    ['suite#3', undefined]
  ]);
  expect(deploy.then.status).toBe('waiting');

  deploy.then.stop();
});

it('will abort the test suite when stopped', async () => {
  const test = vi.spyOn(ci, 'test').mockImplementation(async (_, { signal }) => delay(MINUTE, { signal }));
  const deploy = create();
  const release = deploy.next();

  await vi.waitFor(() => expect(deploy.then.active).toBe('suite'));
  deploy.then.stop();

  await expect(release).rejects.toMatchObject({ name: 'Stopped' });
  expect(test.mock.calls[0][1].signal.aborted).toBe(true);
  expect(test).toHaveBeenCalledTimes(1);
  expect(deploy.report).toBe(`1.2.0 stopped: ${deploy} was stopped.`);
  // a plain stop does not unwind - stop(true) would
  expect(record(deploy).find((entry) => entry.key == 'build')!.undone).toBeUndefined();
});

it('will roll back the canaries and the build when the gate aborts', async () => {
  vi.spyOn(fleet, 'uninstall');
  vi.spyOn(registry, 'unpublish');
  vi.spyOn(git, 'untag');
  vi.spyOn(db, 'migrate');

  const deploy = create();
  const release = deploy.next();

  await untilGate(deploy);
  const stopped = { name: 'Stopped', message: 'canary rejected: error rate', cause: 'canary rejected: error rate' };

  // the answer's own Promise settles with the run it stopped
  await expect(deploy.abort('error rate')).rejects.toMatchObject(stopped);
  await expect(release).rejects.toMatchObject(stopped);

  expect(fleet.uninstall).toHaveBeenCalledWith('web-1');
  expect(fleet.uninstall).toHaveBeenCalledWith('web-4');
  expect(deploy.live.size).toBe(0);
  expect(deploy.canaries).toEqual([]);
  expect(registry.unpublish).toHaveBeenCalledWith('app-1.2.0.tgz');
  expect(git.untag).toHaveBeenCalledWith('1.2.0');
  expect(db.migrate).not.toHaveBeenCalled();
  expect(deploy.then.status).toBe('stopped');
  expect(deploy.report).toBe('1.2.0 stopped: canary rejected: error rate');
  // only entries returning an undo or true are undone - their fields restored too
  expect(record(deploy).map((entry) => [entry.key, entry.undone])).toEqual([
    ['next', undefined],
    ['build', true],
    ['test', undefined],
    ['suite', undefined],
    ['canary', true],
    ['install', true],
    ['install', true],
    ['gate', undefined],
    ['abort', undefined]
  ]);
});

it('will nudge on-call, then abort a gate nobody answers', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(pager, 'nudge');

  const deploy = create();
  const failed = expect(deploy.next()).rejects.toMatchObject({ name: 'Stopped', message: 'canary rejected: nobody approved' });

  await vi.advanceTimersByTimeAsync(15 * MINUTE);
  expect(pager.nudge).toHaveBeenCalledWith('1.2.0 awaits approval');
  expect(deploy.then.status).toBe('waiting');

  await vi.advanceTimersByTimeAsync(45 * MINUTE);
  await failed;
  expect(deploy.live.size).toBe(0);
});

it('will ask before reverting a failed rollout', async () => {
  vi.spyOn(fleet, 'install').mockImplementation(async (host) => {
    if (host == 'web-3') throw new Error('disk full');
  });
  vi.spyOn(fleet, 'uninstall');
  vi.spyOn(fleet, 'serve');
  vi.spyOn(registry, 'unpublish');

  const deploy = create();
  const release = deploy.next();

  await untilGate(deploy);
  await deploy.promote('gabe');

  // the unwind parks on rollout's returned wait; the run has failed but not yet rejected
  await vi.waitFor(() => expect(deploy.keep).toBeDefined());
  expect(deploy.then.status).toBe('waiting');
  expect(deploy.then.error).toEqual(new Error('disk full'));
  expect(deploy.then.waiting).toEqual([{ id: 'wait#2', step: 'rollout', args: [], answers: ['revert', 'keep'] }]);

  await deploy.keep();

  await expect(release).rejects.toThrow('disk full');
  expect(fleet.uninstall).not.toHaveBeenCalled();
  expect([...deploy.live.keys()].sort()).toEqual(['web-1', 'web-2', 'web-4']);
  expect(fleet.serve).not.toHaveBeenCalledWith('web-3');
  // migrate committed, so the unwind halts there: canaries and build stay
  expect(registry.unpublish).not.toHaveBeenCalled();
  expect(record(deploy).map((entry) => [entry.id, entry.committed, entry.halted, entry.undone]).slice(-3)).toEqual([
    ['migrate#1', true, true, undefined],
    ['rollout#1', undefined, undefined, true],
    ['upgrade#1', undefined, undefined, undefined]
  ]);
});

it('will revert a failed rollout nobody answers', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(fleet, 'install').mockImplementation(async (host) => {
    if (host == 'web-3') throw new Error('disk full');
  });
  vi.spyOn(fleet, 'uninstall');

  const deploy = create();
  const failed = expect(deploy.next()).rejects.toThrow('disk full');

  await vi.advanceTimersByTimeAsync(0);
  await deploy.promote('gabe');

  await vi.advanceTimersByTimeAsync(10 * MINUTE);
  await failed;

  expect(fleet.uninstall).toHaveBeenCalledTimes(1);
  expect(fleet.uninstall).toHaveBeenCalledWith('web-2');
  expect([...deploy.live.keys()].sort()).toEqual(['web-1', 'web-4']);
  expect(record(deploy).find((entry) => entry.key == 'rollout')).toMatchObject({ undone: true });
});

it('will stop unwinding at the retired release', async () => {
  const warn = mockWarn();

  vi.spyOn(chat, 'post').mockRejectedValue(new Error('chat is down'));
  vi.spyOn(fleet, 'uninstall');

  const deploy = create();
  const release = deploy.next();

  await untilGate(deploy);
  await deploy.promote('gabe');

  await expect(release).rejects.toThrow('chat is down');
  // a deleted pool member cannot come back: the unwind halts at retire with a warning, before reaching rollout's wait
  expect(record(deploy).at(-1)).toMatchObject({ key: 'retire', irreversible: ['releases'], halted: true });
  expect(warn).toHaveBeenCalledWith(`${deploy} stopped unwinding at retire#1: releases cannot be restored.`);
  expect(deploy.then.status).toBe('failed');
  expect(fleet.uninstall).not.toHaveBeenCalled();
  expect(deploy.releases.map((release) => release.version)).toEqual(['1.1.0', '1.2.0']);
});
