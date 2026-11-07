import { has, map, Model } from '@expressive/mvc';
import { Steps } from '@expressive/steps';

import { chat, ci, db, fleet, git, pager, registry } from './services';

export class Release extends Model {
  version = '';
}

export interface Released {
  version: string;
  hosts: string[];
  approver: string;
}

// compensations put the world back, and an unwind restores the fields of every step it takes back
export class Deploy extends Steps {
  version!: string;
  hosts: string[] = [];
  artifact = '';
  canaries: string[] = [];
  approver = '';
  live = map<string, string>();
  releases = has(Release);
  log = has<string>();
  report = '';

  // the plan, in order - each step runs with everything it schedules before the next starts;
  // run awaits the plan and returns its result, typing `await deploy`
  async run(): Promise<Released> {
    this.build();
    this.test().catch(this.retest);
    this.canary();
    this.migrate();
    this.rollout();
    this.retire();
    this.announce();

    // the tail: after the run, on every outcome - cleanup and reports go here
    try {
      await this;
    } catch (error) {
      this.report = `${this.version} ${this.then.status}: ${(error as Error).message}`;
      throw error;
    }

    const hosts = [...this.live.keys()];

    this.report = `${this.version} live on ${hosts.length} hosts`;

    return { version: this.version, hosts, approver: this.approver };
  }

  protected async build() {
    const artifact = await ci.build(this.version);

    this.artifact = artifact;
    // undos run only on unwind, newest first - steps called for them are recorded with their args
    this.then.undo(this.unpublish(artifact));

    await git.tag(this.version);
    this.then.undo(this.untag(this.version));
  }

  protected async unpublish(artifact: string) {
    await registry.unpublish(artifact);
  }

  protected async untag(version: string) {
    await git.untag(version);
  }

  protected async test() {
    // a replay waits 1s, then 2s first - backoff lives in the retried step
    if (this.then.retried) this.then({ sec: this.then.retried });

    this.suite();
  }

  // a failed suite replays test with its args - three tries in all; past that the error goes on
  protected async retest(error: unknown) {
    if (this.then.retried >= 2) throw error;

    this.then.retry();
  }

  protected async suite() {
    // stop() aborts the suite through the step's own signal - an abort is no failure, so not caught
    await ci.test(this.artifact, { signal: this.then.signal });
  }

  protected async canary() {
    // a helper computes, the step assigns - so the write is journaled
    this.canaries = this._spread(2);

    this.then(this.canaries, this.install);     // a mapped group: install(host, index) per canary, in parallel
    this.approval();                                // scheduled by canary, so it runs before migrate - depth-first
  }

  protected async install(host: string) {
    await fleet.install(host, this.artifact);
    this.live.set(host, this.artifact);

    this.then.undo(this.uninstall(host));
  }

  protected async uninstall(host: string) {
    await fleet.uninstall(host);
    this.live.delete(host);
  }

  protected async approval() {
    // park until promote or reject answers; the steps called beside them race the answer,
    // started with the wait and cancelled once one answers
    this.then(this.promote, this.reject, this.remind(), this.expire());
  }

  protected async remind() {
    this.then({ min: 15 });
    this.nudge();       // settles without answering - the wait stays open
  }

  protected async nudge() {
    pager.nudge(`${this.version} awaits approval`);
  }

  protected async expire() {
    this.then({ hr: 1 });
    this.reject('nobody approved');
  }

  // answering steps are public - from outside they exist only while the wait is open
  async promote(approver: string) {
    this.approver = approver;
  }

  async reject(reason: string) {
    // halt and unwind everything committed, newest first - the reason becomes the Stopped error's message and cause
    this.then.abort(`canary rejected: ${reason}`);
  }

  protected async migrate() {
    await db.migrate(this.version);

    // the point of no return: never retried, and an unwind halts here - build and canaries stay
    this.then.commit();
  }

  protected async rollout() {
    const rest = this.hosts.filter((host) => !this.canaries.includes(host));

    for (const host of rest) this.upgrade(host);     // a plain loop schedules in sequence - one host at a time
  }

  // drained while it installs - a host that fails stays drained; one upgraded is uninstalled on unwind
  protected async upgrade(host: string) {
    fleet.drain(host);
    await fleet.install(host, this.artifact);
    this.live.set(host, this.artifact);
    this.then.undo(this.uninstall(host));
    fleet.serve(host);
  }

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

  // before and after wrap every step, answers included - not compensations; writes here are in no entry
  protected before(step: string, args: unknown[]) {
    this.log.push(`${step}(${args.join(', ')})`);
  }

  protected after(step: string, entry: Steps.Entry) {
    this.log.push(`${entry.id} ok`);
  }

  // a helper: `_` keeps it from being a step - runs normally on the instance.
  private _spread(count: number) {
    const every = Math.ceil(this.hosts.length / count);

    return this.hosts.filter((_, index) => index % every == 0);
  }
}
