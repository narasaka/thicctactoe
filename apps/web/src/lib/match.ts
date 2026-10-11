import { type Move, play, replay } from "@thicctactoe/game";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { client } from "@/utils/orpc";

import { type MatchView, newer } from "./match-view";

/**
 * Live state of an online game for the signed-in user, with optimistic moves.
 * Reconnects with backoff if the stream drops.
 */
export function useMatch(gameId: string, userId: string | undefined) {
  const [view, setView] = useState<MatchView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Move | null>(null);

  const seat = view?.seat ?? null;

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void (async () => {
      for (let attempt = 0; !controller.signal.aborted; attempt++) {
        try {
          const stream = await client.arena.watch({ id: gameId }, { signal: controller.signal });
          for await (const update of stream) {
            attempt = 0;
            setView((current) => newer(current, update));
          }
        } catch (cause) {
          if (controller.signal.aborted) return;
          if ((cause as { code?: string }).code === "NOT_FOUND") return setError("Game not found");
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 10_000)));
      }
    })();
    return () => controller.abort();
    // Resubscribe once seated so the server counts us as present.
  }, [gameId, userId, seat]);

  const apply = (update: MatchView) => setView((current) => newer(current, update));
  const onError = (cause: Error) => toast.error(cause.message);

  const join = useMutation({
    mutationFn: () => client.arena.join({ id: gameId }),
    onSuccess: apply,
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

  return { view, game, seat, error, join, move, resign, cancel };
}
