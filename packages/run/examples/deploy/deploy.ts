import { has, map, Model } from '@expressive/mvc';
import { Job, type Runner } from '@expressive/run';

import { chat, ci, db, delay, fleet, git, HOUR, MINUTE, pager, registry, SECOND } from './services';

export class Release extends Model {
  version = '';
}

export interface Released {
  version: string;
  hosts: string[];
  approver: string;
}

// light journal: undos put the world back, fields of settled steps stay as they were left
export class Deploy extends Job {
  version!: string;
  hosts: string[] = [];
  artifact = '';
  canaries: string[] = [];
  approver = '';
  live = map<string, string>();
  releases = has(Release);
  log = has<string>();
  report = '';

  // the plan, in order - each step runs with everything it schedules before the next starts
  async next() {
    this.build();
    this.test();
    this.canary();
    this.migrate();
    this.rollout();
    this.retire();
    this.announce();
    this.end();
  }

  protected async build() {
    this.artifact = await ci.build(this.version);
    await git.tag(this.version);

    // a returned group is the undo - its members run concurrently, only on unwind
    return this.then(this.unpublish(this.artifact), this.untag(this.version));
  }

  protected async unpublish(artifact: string) {
    await registry.unpublish(artifact);
  }

  protected async untag(version: string) {
    await git.untag(version);
  }

  protected async test() {
    // a retry waits 1s, then 2s - a slot without max is a plain delay
    this.then.slot({ after: this.then.attempt * SECOND });

    // a failed suite runs test again in its place - attempt counts the re-runs - three tries in all
    this.suite().catch(this.then.attempt < 2 ? this.test : undefined);
  }

  protected async suite() {
    // stop() aborts the suite through the step's own signal - an abort is no failure, so not caught
    await ci.test(this.artifact, { signal: this.then.signal });
  }

  protected async canary() {
    // a helper computes, the step assigns - so the write is journaled
    this.canaries = this._spread(2);

    this.then(this.canaries, this.install);     // a mapped group: install(host, index) per canary, in parallel
    this.gate();                                // scheduled by canary, so it runs before migrate - depth-first
  }

  protected async install(host: string) {
    await fleet.install(host, this.artifact);
    this.live.set(host, this.artifact);

    // a returned token is a durable undo - a closure here would warn once the gate waits
    return this.uninstall(host);
  }

  protected async uninstall(host: string) {
    await fleet.uninstall(host);
    this.live.delete(host);
  }

  protected async gate() {
    // park until promote or abort answers; plain functions after them are watchers
    this.then(
      this.promote,
      this.abort,
      async (signal) => {
        await delay(15 * MINUTE, { signal });
        pager.nudge(`${this.version} awaits approval`);     // settles without answering - the wait stays open
      },
      async (signal) => {
        await delay(HOUR, { signal });
        this.abort('nobody approved');
      }
    );
  }

  // answering steps are public - from outside they exist only while the gate waits
  async promote(approver: string) {
    this.approver = approver;
  }

  async abort(reason: string) {
    // cancel and unwind everything committed, newest first - the reason becomes the Stopped error's message and cause
    this.then.stop(true, `canary rejected: ${reason}`);
  }

  protected async migrate() {
    await db.migrate(this.version);

    // the point of no return: never retried, and an unwind halts here - build and canaries stay
    this.then.commit();
  }

  protected async rollout() {
    const rest = this.hosts.filter((host) => !this.canaries.includes(host));

    for (const host of rest) this.upgrade(host);     // a plain loop schedules in sequence - one host at a time

    // a returned wait is the undo: an unwind parks here until an operator answers, else reverts after 10 minutes
    return this.then(this.revert, this.keep, async (signal) => {
      await delay(10 * MINUTE, { signal });
      return this.revert();
    });
  }

  protected async upgrade(host: string) {
    await fleet.install(host, this.artifact);
    this.live.set(host, this.artifact);
  }

  // a per-step hook gets the step's own args; skip is reserved for replay, always false here
  protected beforeUpgrade(skip: boolean, host: string) {
    fleet.drain(host);
  }

  // after hooks run once the step commits - a host that failed stays drained
  protected afterUpgrade(skip: boolean, entry: Runner.Entry) {
    fleet.serve(entry.args[0] as string);
  }

  // an unwind answer runs as an undo frame: journaled with wake, no hooks, cannot schedule
  async revert() {
    const upgraded = [...this.live.keys()].filter((host) => !this.canaries.includes(host));

    await Promise.all(upgraded.map((host) => fleet.uninstall(host)));

    for (const host of upgraded) this.live.delete(host);
  }

  async keep() {}

  protected async retire() {
    const [oldest] = this.releases;

    await registry.remove(oldest.version);

    this.releases.add({ version: this.version });
    // deleting a pool member destroys it - nothing can restore that, so this step is irreversible
    this.releases.delete(oldest);
  }

  protected async announce() {
    await chat.post(`${this.version} is live on ${this.live.size} hosts`);
  }

  // its return types `await deploy`
  protected end(): Released {
    return { version: this.version, hosts: [...this.live.keys()], approver: this.approver };
  }

  // before and after wrap every step, answers included; writes here are in no entry
  protected before(step: string, args: unknown[]) {
    this.log.push(`${step}(${args.join(', ')})`);
  }

  protected after(step: string, entry: Runner.Entry) {
    this.log.push(`${entry.id} ok`);
  }

  // once per run on every outcome - after the unwind and back, before the run settles
  protected exit(outcome: Runner.Outcome<Released>) {
    if (outcome.status == 'done')
      this.report = `${this.version} live on ${outcome.result.hosts.length} hosts`;
    else
      this.report = `${this.version} ${outcome.status}: ${(outcome.error as Error).message}`;
  }

  // a helper: `_` keeps it from being a step - it runs inline on the instance
  _spread(count: number) {
    const every = Math.ceil(this.hosts.length / count);

    return this.hosts.filter((_, index) => index % every == 0);
  }
}
