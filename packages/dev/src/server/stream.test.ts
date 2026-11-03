import { describe, expect, it } from "vitest";

import { connect } from "./connection";
import { isStream, stream } from "./stream";

const request = (url: string, method = "GET", signal?: AbortSignal) => new Request(`http://localhost${url}`, { method, signal });

function opened() {
  const id = crypto.randomUUID();
  const aborted = new AbortController();
  const response = stream(request(`/.expressive/stream?connection=${id}`, "GET", aborted.signal));

  return { response, aborted, connection: connect(id)!, reader: response.body!.getReader() };
}

describe("stream", () => {
  it("will identify a GET of the stream path, whatever its query", () => {
    expect(isStream(request("/.expressive/stream?connection=x"))).toBe(true);
    expect(isStream(request("/.expressive/stream", "POST"))).toBe(false);
    expect(isStream(request("/.expressive/streams"))).toBe(false);
  });

  it("will reply 400 without a connection id", () => {
    const response = stream(request("/.expressive/stream"));

    expect(response.status).toBe(400);
    expect(response.body).toBeNull();
  });

  it("will hold the response open as an event stream on the tab's connection, until the request aborts", async () => {
    const { response, aborted, connection, reader } = opened();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(new TextDecoder().decode((await reader.read()).value)).toBe(`event: hello\ndata: {"epoch":"${connection.epoch}"}\n\n`);
    expect(connection.sink).toBeDefined();

    aborted.abort();

    expect(connection.sink).toBeUndefined();
    expect((await reader.read()).done).toBe(true);
  });

  it("will stop listening when its reader cancels", async () => {
    const { aborted, connection, reader } = opened();

    await reader.cancel();
    expect(connection.sink).toBeUndefined();

    expect(() => aborted.abort()).not.toThrow();
  });
});
