import "@expressive/dom";

import { install as resolve, onBuild } from "@expressive/rpc/protocol";

import { track } from "./version";

export function install() {
  onBuild(track);
  resolve();
}
