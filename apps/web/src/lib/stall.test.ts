import { expect, test } from "bun:test";

import { failOnStall } from "./stall";

const encoder = new TextEncoder();

/** A server that sends `chunks`, one every `everyMs`, then goes silent without closing. */
function serverSending(chunks: string[], everyMs: number) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    let timer: ReturnType<typeof setInterval>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const queue = [...chunks];
        timer = setInterval(() => {
          const next = queue.shift();
          if (next !== undefined) controller.enqueue(encoder.encode(next));
        }, everyMs);
        signal?.addEventListener("abort", () => {
          clearInterval(timer);
          controller.error(signal.reason);
        });
      },
      cancel: () => clearInterval(timer),
    });
    return new Response(body);
  };
}

async function readAll(response: Response) {
  const reader = response.body!.getReader();
  let text = "";
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    text += new TextDecoder().decode(read.value);
  }
  return text;
}

test("a stream that goes silent fails instead of hanging", async () => {
  const response = await failOnStall(serverSending(["a", "b"], 10), 50)("http://x");
  const started = performance.now();
  await expect(readAll(response)).rejects.toThrow("stalled");
  expect(performance.now() - started).toBeLessThan(500);
});

test("a stream that keeps talking stays open", async () => {
  // Five chunks 20ms apart outlast the 50ms limit only if the timer is reset.
  const chunks = ["a", "b", "c", "d", "e"];
  const fetch = serverSending(chunks, 20);
  const response = await failOnStall(fetch, 50)("http://x");
  const reader = response.body!.getReader();
  let text = "";
  while (text.length < chunks.length) {
    text += new TextDecoder().decode((await reader.read()).value);
  }
  expect(text).toBe("abcde");
  await reader.cancel();
});

test("a request that never gets a response fails", async () => {
  const silent = (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) =>
      init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)),
    );
  await expect(failOnStall(silent, 50)("http://x")).rejects.toThrow("stalled");
});

test("the caller can still cancel", async () => {
  const controller = new AbortController();
  const response = await failOnStall(serverSending([], 10), 10_000)("http://x", {
    signal: controller.signal,
  });
  const read = readAll(response);
  controller.abort();
  await expect(read).rejects.toThrow();
});

test("the caller can cancel through the request's own signal", async () => {
  const controller = new AbortController();
  const request = new Request("http://x", { signal: controller.signal });
  const response = await failOnStall(serverSending([], 10), 10_000)(request);
  const read = readAll(response);
  controller.abort();
  await expect(read).rejects.toThrow();
});
