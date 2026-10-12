type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Wraps `fetch` so a request fails once its connection has been silent for
 * `ms`: no response yet, or no new bytes of the body. Live game streams carry
 * a keepalive every few seconds, so silence means the connection died without
 * closing, as phones' connections do when they sleep or switch networks.
 * Failing lets the caller reconnect instead of waiting on it forever.
 */
export function failOnStall(fetch: Fetch, ms: number): Fetch {
  return async (input, init) => {
    const stalled = new AbortController();
    // oRPC passes a Request carrying its signal; ours replaces it, so include it.
    const cancelled = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const signal = cancelled ? AbortSignal.any([cancelled, stalled.signal]) : stalled.signal;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => clearTimeout(timer);
    const restart = () => {
      stop();
      timer = setTimeout(
        () => stalled.abort(new DOMException("The connection stalled", "TimeoutError")),
        ms,
      );
    };
    signal.addEventListener("abort", stop, { once: true });

    restart();
    const response = await fetch(input, { ...init, signal }).catch((error) => {
      stop();
      throw error;
    });
    if (!response.body) {
      stop();
      return response;
    }
    restart();
    const body = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          restart();
          controller.enqueue(chunk);
        },
        flush: stop,
      }),
      { signal },
    );
    return new Response(body, response);
  };
}
