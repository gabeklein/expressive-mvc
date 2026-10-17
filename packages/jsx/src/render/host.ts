import type { Claim } from '../style/claim';

type HostNode = object;

interface Host<N extends HostNode = any> {
  element(tag: string, parent: N): N;
  text(value: string): N;
  marker(label: string): N;
  fragment(): N;

  insert(parent: N, node: N, before: N | null): void;
  remove(node: N): void;
  parent(node: N): N | null;
  next(node: N): N | null;
  root(node: N): N;
  clear(container: N): void;
  setText(node: N, value: string): void;
  target(into: unknown, parent: N): N;

  prop(element: N, key: string, previous: unknown, next: unknown): void;
  style(element: N, previous: Claim | undefined, next: Claim): void;

  raw?: string;
  deferred?: readonly string[];
  created?(element: N, props: Record<string, any>): void;
  settle?(element: N, next: Record<string, any>, previous: Record<string, any>): void;
  release?(element: N): void;
  flush?(): void;
}

let host: Host;

function install(next: Host) {
  host = next;
}

export { host, install };
export type { Host, HostNode };
