import inspect from "@expressive/inspect/vite";
import { createServer } from "vite";

import { viteConfigFile } from "./config";
import { expressive } from "./plugin";

export async function runDev(root = process.cwd()): Promise<void> {
  const host = expressive();

  const server = await createServer({
    root,
    configFile: viteConfigFile(root),
    plugins: [host, inspect()],
  });

  const { port } = await host.api!.config();

  await server.listen(port);
  server.printUrls();
}
