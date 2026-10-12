import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { HistoryEntry } from "@thicctactoe/api/arena";
import { other } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";
import { Loader2 } from "lucide-react";

import Avatar from "@/components/avatar";
import Button, { buttonClass } from "@/components/button";
import Layout from "@/components/layout";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/history/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Your games | ThiccTacToe" }] }),
  component: HistoryPage,
});

const SEAT_COLOR = { X: "bg-emerald-400", O: "bg-indigo-400" } as const;

const RESULT = {
  win: { label: "Win", className: "bg-emerald-100 text-emerald-700" },
  loss: { label: "Loss", className: "bg-rose-100 text-rose-700" },
  draw: { label: "Draw", className: "bg-neutral-100 text-neutral-600" },
} as const;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function HistoryPage() {
  const { data: session, isPending } = authClient.useSession();
  const history = useInfiniteQuery({
    ...orpc.arena.history.infiniteOptions({
      input: (after: string | undefined) => ({ after }),
      initialPageParam: undefined,
      getNextPageParam: (page) => page.next ?? undefined,
    }),
    enabled: !!session,
  });
  const games = history.data?.pages.flatMap((page) => page.games) ?? [];
  const loading = isPending || (!!session && history.isPending);

  return (
    <Layout className="container max-w-2xl">
      <h1 className="text-center text-5xl font-extrabold tracking-tight sm:text-6xl">Your games</h1>
      <p className="mt-2 text-center text-gray-500">
        Every online game you finished, move by move.
      </p>
      <div className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm">
        {loading ? (
          <div className="grid place-items-center p-10">
            <Loader2 className="animate-spin text-neutral-400" />
          </div>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center gap-4 p-10 text-center text-gray-500">
            No finished games yet.
            <Link to="/play" className={buttonClass()}>
              Play online
            </Link>
          </div>
        ) : (
          <ul>
            {games.map((game) => (
              <GameRow key={game.id} game={game} />
            ))}
          </ul>
        )}
      </div>
      {history.hasNextPage && (
        <div className="mt-4 text-center">
          <Button
            intent="secondary"
            disabled={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            {history.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </Layout>
  );
}

function GameRow({ game }: { game: HistoryEntry }) {
  const result = RESULT[game.result];
  const { ratingDelta: delta } = game;
  return (
    <li className="border-t border-neutral-100 first:border-t-0">
      <Link
        to="/history/$gameId"
        params={{ gameId: game.id }}
        className="flex items-center gap-3 px-4 py-3 transition hover:bg-neutral-50"
      >
        <span
          className={cn("w-12 rounded-md py-1 text-center text-xs font-semibold", result.className)}
        >
          {result.label}
        </span>
        <div className="relative">
          <Avatar name={game.opponent?.name ?? "?"} image={game.opponent?.image} />
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white",
              SEAT_COLOR[other(game.seat)],
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">
            <span className="font-normal text-neutral-400">vs </span>
            {game.opponent?.name ?? "Deleted player"}
          </div>
          <div className="truncate text-xs text-neutral-500">
            {game.moveCount} {game.moveCount === 1 ? "move" : "moves"}
            {game.endReason === "resign" &&
              (game.result === "win" ? " · they resigned" : " · you resigned")}
            {game.private && " · friend game"} · {dateFormat.format(game.finishedAt)}
          </div>
        </div>
        {delta !== null && (
          <span
            className={cn(
              "font-mono text-sm font-semibold",
              delta >= 0 ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {delta >= 0 ? `+${delta}` : delta}
          </span>
        )}
      </Link>
    </li>
  );
}
