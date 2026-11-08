import "@expressive/dom";

import { install as resolve } from "@expressive/rpc";
import { onBuild } from "@expressive/rpc/internal";

import { track } from "./version";

export function install() {
  onBuild(track);
  resolve();
}
