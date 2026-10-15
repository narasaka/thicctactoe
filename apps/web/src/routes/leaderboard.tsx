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

function LeaderboardPage() {
  const { data: players = [] } = useQuery(orpc.leaderboard.queryOptions());

  return (
    <Layout className="container max-w-2xl">
      <h1 className="text-center text-5xl font-extrabold tracking-tight sm:text-6xl">
        Leaderboard
      </h1>
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
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-neutral-400 uppercase">
              <tr>
                <th className="w-12 py-3 pl-4">#</th>
                <th className="py-3">Player</th>
                <th className="py-3 pr-4 text-right">Rating</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.rank} className="border-t border-neutral-100">
                  <td
                    className={cn(
                      "py-3 pl-4 font-semibold",
                      player.rank <= 3 ? "text-amber-500" : "text-neutral-400",
                    )}
                  >
                    {player.rank}
                  </td>
                  <td className="py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={player.name} image={player.image} />
                      <span className="truncate font-medium">{player.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono font-semibold">{player.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
