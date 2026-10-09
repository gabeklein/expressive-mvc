export { Route, NotFound, Router } from "./client";
export { Link, NavLinks, Redirect } from "@expressive/router";
export { Fragment, Portal, createElement, css, macro, render, style } from "@expressive/dom";
export type { JSX } from "@expressive/dom";
export { config, type AppConfig } from "./config";

export function serve(): never {
  throw new Error("serve() runs on the server only.");
}
