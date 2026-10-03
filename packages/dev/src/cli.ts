#!/usr/bin/env node

const HELP = `expressive - Expressive Dev

Usage:
  expressive                 Run dev server (alias for 'dev')
  expressive dev             Run Vite dev server with HMR, the inspector, and app/api on the module runner
  expressive build           dist/client (static app) + dist/server/index.js (node service)
  expressive build --pretty  Readable client output (unminified, stable filenames)
  expressive --help

Project layout:
  app/                   File-based routes (index.tsx, [slug].tsx, (static).tsx, [...].tsx)
  app/api/               Server modules: exports serve at POST /api/<module>/<fn> (JSON array body)
  app.tsx | src/app.tsx  Or: a single root component (default export)
  index.ts               Optional. Service entry on the server (export default app({ port }))
  index.html             Optional. Custom HTML shell
  vite.config.ts         Optional. Extra Vite config, merged under Expressive's
`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === "-h" || cmd === "--help") {
    console.log(HELP);
    return;
  }

  try {
    switch (cmd) {
      case undefined:
      case "dev": {
        const { runDev } = await import("./vite/dev");
        await runDev();
        return;
      }
      case "build": {
        const { runBuild } = await import("./vite/build");
        await runBuild(process.cwd(), { pretty: rest.includes("--pretty") });
        return;
      }
      default:
        console.error(`Unknown command: ${cmd}\n\n${HELP}`);
        process.exit(1);
    }
  } catch (err: any) {
    console.error(err?.message ?? err);
    process.exit(1);
  }
}

main();
