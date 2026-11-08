import { Manifest, type Exposed as Plain } from "@expressive/rpc/internal/vite";

import type { Remote } from "./routes";
import type { Shape } from "../server/connection";
import type { Twin } from "./scan";

export interface Definition {
  name: string;
  fields: string[];
  methods: Record<string, string>;
  children?: Record<string, Definition>;
}

export function pathsOf(twin: Twin, prefix = ""): string[] {
  return [
    ...twin.methods.map(name => prefix + name),
    ...Object.entries(twin.children ?? {}).flatMap(([field, child]) => pathsOf(child, `${prefix}${field}.`)),
  ];
}

export function shapeOf({ fields, children }: Twin): Shape {
  return children ? { fields, children: Object.fromEntries(Object.entries(children).map(([field, child]) => [field, shapeOf(child)])) } : { fields };
}

export interface Exposed extends Remote, Plain {
  pooled: Twin[];
  seat?: Twin;
}

export class Exposure extends Manifest<Exposed> {
  methodIds(remote: Remote, twin: Twin, pooled: boolean): Record<string, string> {
    return Object.fromEntries(pathsOf(twin).map(path => [this.methodId(remote, twin, pooled, path), path]));
  }

  definition(remote: Remote, twin: Twin, pooled: boolean, root = twin, prefix = ""): Definition {
    const definition: Definition = {
      name: twin.name,
      fields: twin.fields,
      methods: Object.fromEntries(twin.methods.map(name => [name, this.methodId(remote, root, pooled, prefix + name)])),
    };

    if (twin.children)
      definition.children = Object.fromEntries(
        Object.entries(twin.children).map(([field, child]) => [field, this.definition(remote, child, pooled, root, `${prefix}${field}.`)]),
      );

    return definition;
  }

  private methodId(remote: Remote, twin: Twin, pooled: boolean, path: string): string {
    return pooled ? this.classId(remote, `${twin.name}.${path}`) : this.callId(remote, `default.${path}`);
  }
}
