import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { cn } from "@thicctactoe/ui/lib/utils";

import Avatar from "@/components/avatar";
import { buttonClass } from "@/components/button";
import Layout from "@/components/layout";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard | ThiccTacToe" }] }),
  // Prefetch never throws, so an API hiccup falls back to loading on the client.
  loader: ({ context }) => context.queryClient.prefetchQuery(orpc.leaderboard.queryOptions()),
  component: LeaderboardPage,
});

const ROW = "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3";

function LeaderboardPage() {
  const { data: players = [] } = useQuery(orpc.leaderboard.queryOptions());

  return (
    <Layout className="container max-w-2xl">
      <h1 className="text-center text-5xl font-pixel sm:text-6xl">Leaderboard</h1>
      <p className="mt-2 text-center text-gray-500">Signed-in players, ranked by rating.</p>
      <div className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm">
        {players.length === 0 ? (
          <div className="flex flex-col items-center gap-4 p-10 text-center text-gray-500">
            Nobody is on the board yet.
            <Link to="/play" className={buttonClass()}>
              Be the first
            </Link>
          </div>
        ) : (
          <div className="text-sm">
            <div className={cn(ROW, "text-xs text-neutral-400 uppercase")}>
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Rating</span>
            </div>
            <ol>
              {players.map((player) => (
                <li key={player.id} className="border-t border-neutral-100">
                  <Link
                    to="/players/$playerId"
                    params={{ playerId: player.id }}
                    className={cn(ROW, "transition hover:bg-neutral-50")}
                  >
                    <span
                      className={cn(
                        "font-semibold",
                        player.rank <= 3 ? "text-amber-500" : "text-neutral-400",
                      )}
                    >
                      {player.rank}
                    </span>
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={player.name} image={player.image} />
                      <span className="truncate font-medium">{player.name}</span>
                    </span>
                    <span className="text-right font-mono font-semibold">{player.rating}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Layout>
  );
}
