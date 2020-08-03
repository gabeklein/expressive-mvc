/**
 * JIT compile typescript using ts-node.
 * Testing should not use internal types though.
 * This module casts public types onto src exports.
 * */

// source code
import * as ts from "../src";
// public type definitions
import * as td from "../";

export const get = ts.get as typeof td.get;
export const Controller = ts.Controller as unknown as typeof td.Controller;
export const Provider = ts.Provider as unknown as typeof td.Provider;
export default Controller