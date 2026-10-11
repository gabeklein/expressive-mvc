import { createHash } from "node:crypto";

import type { Remote } from "./routes";

export interface Exposed extends Remote {
  calls: string[];
  classes: string[];
}

export class Exposure {
  readonly remotes = new Map<string, Exposed>();

  constructor(readonly salt?: string) {}

  callId(remote: Remote, name: string): string {
    return this.salt ? this.seal(globalId(remote, name)) : localId(remote, name);
  }

  classId(remote: Remote, name: string): string {
    return this.seal(globalId(remote, name));
  }

  byPattern(): Exposed[][] {
    const groups = new Map<string, Exposed[]>();

    for (const remote of this.remotes.values()) {
      const key = remote.pattern.join("/");
      groups.set(key, [...(groups.get(key) ?? []), remote]);
    }

    return [...groups.values()];
  }

  private seal(id: string): string {
    return this.salt ? createHash("sha256").update(this.salt + id).digest("base64url").slice(0, 16) : id;
  }
}

const localId = ({ module }: Remote, name: string) => (module ? `${module}:${name}` : name);
const globalId = (remote: Remote, name: string) => `/${remote.pattern.join("/")}#${localId(remote, name)}`;
