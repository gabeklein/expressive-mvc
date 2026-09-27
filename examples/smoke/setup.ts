import { afterEach, beforeEach, expect } from 'vitest';
import { mkdirSync, writeFileSync } from "node:fs";
import { cleanup, errors, RENDERER, trail } from "./harness";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const origError = console.error;

beforeEach(() => {
  errors.length = 0;
  console.error = (...args: unknown[]) => { errors.push(args); };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onError);
  (window as any).alert = (msg: string) => { (window as any).alerts.push(msg); };
  (window as any).alerts = [];
});

afterEach(async () => {
  await cleanup();
  const name = (expect.getState().currentTestName ?? "unknown").replace(/[^\w.-]+/g, "_");
  mkdirSync(`smoke/out/${RENDERER}`, { recursive: true });
  writeFileSync(`smoke/out/${RENDERER}/${name}.html`, trail.splice(0).join("\n\n") + "\n");
  console.error = origError;
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onError);
  document.body.replaceChildren();
  history.replaceState(null, '', '/');
  const unexpected = errors.splice(0);
  expect(unexpected.map(e => e.map(String).join(' ')), 'console.error / uncaught during scenario').toEqual([]);
});

function onError(event: any) {
  errors.push(['uncaught', event.error ?? event.reason ?? event.message]);
}
