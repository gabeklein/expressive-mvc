import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sendFile } from ".";

describe("static files", () => {
  const dir = mkdtempSync(join(tmpdir(), "client-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<html></html>");
  writeFileSync(join(dir, "assets", "app.js"), "1");

  const response = () => {
    const headers: Record<string, string> = {};
    let ended = false;
    const res = {
      statusCode: 0,
      setHeader: (k: string, v: string) => { headers[k] = v; },
      end: () => { ended = true; },
      on: () => res,
      once: () => res,
      emit: () => true,
      write: () => true,
      headers,
      get ended() { return ended; },
    };
    return res;
  };

  it("sends a file under the directory with its type; assets are immutable", () => {
    const res = response();
    expect(sendFile(res as any, dir, "/assets/app.js")).toBe(true);
    expect(res.headers["Content-Type"]).toContain("javascript");
    expect(res.headers["Cache-Control"]).toContain("immutable");
  });

  it("will not serve a missing file, a directory, or a path outside the directory", () => {
    expect(sendFile(response() as any, dir, "/nope.js")).toBe(false);
    expect(sendFile(response() as any, dir, "/assets")).toBe(false);
    expect(sendFile(response() as any, dir, "/../" + dir.split("/").pop() + "/index.html")).toBe(false);
    expect(sendFile(response() as any, join(dir, "assets"), "/../index.html")).toBe(false);
  });
});
