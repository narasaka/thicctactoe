import { type Move, play, replay } from "@thicctactoe/game";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { client } from "@/utils/orpc";

import { type MatchView, newer } from "./match-view";

/** Hidden this long, a phone has likely dropped the stream: reconnect on return. */
const RESUME_AFTER_MS = 5_000;

/**
 * Live state of an online game for the signed-in user, with optimistic moves.
 * Reconnects with backoff if the stream drops, and right away when the page
 * comes back after being hidden or offline.
 */
export function useMatch(gameId: string, userId: string | undefined) {
  const [view, setView] = useState<MatchView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Move | null>(null);
  const [joined, setJoined] = useState(false);

  const seat = view?.seat ?? null;

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    let attempt = 0;
    let stream: AbortController | undefined;
    let wake: (() => void) | undefined;
    /** Drops the current stream, or the wait before the next, and connects again now. */
    const reconnect = () => {
      attempt = 0;
      stream?.abort();
      wake?.();
    };

    void (async () => {
      while (!controller.signal.aborted) {
        stream = new AbortController();
        try {
          const updates = await client.arena.watch(
            { id: gameId },
            { signal: AbortSignal.any([controller.signal, stream.signal]) },
          );
          for await (const update of updates) {
            attempt = 0;
            setView((current) => newer(current, update));
          }
        } catch (cause) {
          if (controller.signal.aborted) return;
          if ((cause as { code?: string }).code === "NOT_FOUND") return setError("Game not found");
        }
        if (stream.signal.aborted) continue;
        await new Promise<void>((resolve) => {
          wake = resolve;
          setTimeout(resolve, Math.min(1000 * 2 ** attempt++, 10_000));
        });
      }
    })();

    let hiddenAt = Date.now();
    const onVisibilityChange = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (Date.now() - hiddenAt > RESUME_AFTER_MS) reconnect();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", reconnect);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", reconnect);
    };
    // The server counts players as present from when their stream opens, so a
    // spectator who just took a seat subscribes again.
  }, [gameId, userId, joined]);

  const apply = (update: MatchView) => setView((current) => newer(current, update));
  const onError = (cause: Error) => toast.error(cause.message);

  const join = useMutation({
    mutationFn: () => client.arena.join({ id: gameId }),
    onSuccess: (update) => {
      apply(update);
      setJoined(true);
    },
    onError,
  });
  const move = useMutation({
    mutationFn: (next: Move) => client.arena.move({ id: gameId, move: next }),
    onMutate: setPending,
    onSuccess: apply,
    onError,
    onSettled: () => setPending(null),
  });
  const resign = useMutation({
    mutationFn: () => client.arena.resign({ id: gameId }),
    onSuccess: apply,
    onError,
  });
  const rematch = useMutation({
    mutationFn: () => client.arena.rematch({ id: gameId }),
    onSuccess: apply,
    onError,
  });
  const cancel = useMutation({
    mutationFn: () => client.arena.cancel({ id: gameId }),
    onSuccess: apply,
    onError,
  });

  const game = useMemo(() => {
    const confirmed = replay(view?.moves ?? []);
    if (!pending) return confirmed;
    const optimistic = play(confirmed, pending);
    return optimistic.ok ? optimistic.game : confirmed;
  }, [view?.moves, pending]);

  return { view, game, seat, error, join, move, resign, rematch, cancel };
}
