import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { resolveProject } from "./project";
import { launch } from "./render";
import { staticPaths } from "./routes";
import { scanExports } from "./scan";

export const SHELL = "200.html";

/** Write `dist/client/<path>/index.html` for each static page, keeping the empty shell as `200.html`. */
export async function prerender(root: string): Promise<string[]> {
  const project = resolveProject(root);
  const dir = join(root, "dist", "client");
  const shell = readFileSync(join(dir, "index.html"), "utf8");
  const queue = project.appDir ? await staticPaths(project.appDir, scanExports) : ["/"];
  const written: string[] = [];

  writeFileSync(join(dir, SHELL), shell);

  const { render, close } = await launch(root);

  try {
    for (const path of queue) {
      try {
        const page = await render(path, shell);

        if (page.path !== path) {
          console.warn(`${path} redirected to ${page.path} at build - left to the client.`);
          continue;
        }

        if (page.blank) {
          console.warn(`${path} rendered nothing at build - left to the client.`);
          continue;
        }

        mkdirSync(join(dir, path), { recursive: true });
        writeFileSync(join(dir, path, "index.html"), page.html);
        written.push(path);
      } catch (error) {
        console.warn(`${path} was not prerendered: ${(error as Error).message}`);
      }
    }
  } finally {
    close();
  }

  console.log(`Prerendered ${written.length} page${written.length == 1 ? "" : "s"}.`);

  return written;
}
