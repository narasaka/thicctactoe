import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import Button from "@/components/button";
import Layout from "@/components/layout";
import { useGuestSession } from "@/lib/session";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/play/")({
  ssr: false,
  component: LobbyPage,
});

function LobbyPage() {
  const session = useGuestSession();
  const navigate = useNavigate();
  const [rated, setRated] = useState(false);
  const guest = session?.user.isAnonymous ?? true;
  const open = (game: Promise<{ id: string }>) =>
    game.then(({ id }) => navigate({ to: "/play/$gameId", params: { gameId: id } }));
  const quickMatch = useMutation({
    mutationFn: () => open(client.arena.quickMatch()),
    onError: (error) => toast.error(error.message),
  });
  const invite = useMutation({
    mutationFn: () => open(client.arena.invite({ rated: rated && !guest })),
    onError: (error) => toast.error(error.message),
  });
  const busy = !session || quickMatch.isPending || invite.isPending;

  return (
    <Layout className="container max-w-md text-center">
      <h1 className="text-5xl font-pixel sm:text-6xl">Play online</h1>
      {/* Reserved height: the text depends on the session, which loads after first paint. */}
      <p className="mt-2 min-h-18 text-gray-500">
        {session &&
          (session.user.isAnonymous
            ? `You're playing as ${session.user.name}. Guest games are unrated; sign in any time to play rated games and join the leaderboard.`
            : "Matches against other signed-in players count towards the leaderboard. Friend games do too if you make them rated.")}
      </p>
      <div className="mt-6 flex flex-col gap-2 px-8 md:flex-row md:justify-center">
        <Button disabled={busy} onClick={() => quickMatch.mutate()}>
          Find a match
        </Button>
        <Button intent="secondary" disabled={busy} onClick={() => invite.mutate()}>
          Play a friend
        </Button>
      </div>
      {/* Guests can't play rated games, so they don't get the choice. */}
      {!guest && (
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            className="size-4 cursor-pointer accent-neutral-800"
            checked={rated}
            onChange={(event) => setRated(event.target.checked)}
          />
          Rated friend game
        </label>
      )}
    </Layout>
  );
}
