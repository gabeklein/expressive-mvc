import { afterEach, beforeEach, expect, it, vi } from "vitest";

const runDev = vi.hoisted(() => vi.fn(async () => {}));
const runBuild = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("./vite/dev", () => ({ runDev }));
vi.mock("./vite/build", () => ({ runBuild }));

const argv = process.argv;
let log: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
let exit: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  log = vi.spyOn(console, "log").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  exit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
});

afterEach(() => {
  process.argv = argv;
  vi.restoreAllMocks();
  runDev.mockReset();
  runBuild.mockReset();
});

async function run(...args: string[]) {
  process.argv = ["node", "expressive", ...args];
  // @ts-expect-error
  await import("./cli");
  await vi.waitFor(() => expect(runDev.mock.calls.length + runBuild.mock.calls.length + log.mock.calls.length + exit.mock.calls.length).toBeGreaterThan(0));
}

it("will run dev by default", async () => {
  await run();
  expect(runDev).toHaveBeenCalled();
});

it("will run dev", async () => {
  await run("dev");
  expect(runDev).toHaveBeenCalled();
});

it("will run build", async () => {
  await run("build", "--pretty");
  expect(runBuild).toHaveBeenCalledWith(process.cwd(), { pretty: true });
});

it("will print help", async () => {
  await run("--help");
  expect(log.mock.calls[0][0]).toContain("Usage:");
});

it("will exit on an unknown command", async () => {
  await run("deploy");
  expect(error.mock.calls[0][0]).toContain("Unknown command: deploy");
  expect(exit).toHaveBeenCalledWith(1);
});

it("will exit with the message of a failure", async () => {
  runBuild.mockRejectedValueOnce(new Error("broke"));
  await run("build");
  await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
  expect(error).toHaveBeenCalledWith("broke");
});

it("will exit with a thrown value that is not an error", async () => {
  runDev.mockRejectedValueOnce("broke");
  await run();
  await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
  expect(error).toHaveBeenCalledWith("broke");
});
