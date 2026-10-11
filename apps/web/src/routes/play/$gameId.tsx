import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { type Player, other } from "@thicctactoe/game";
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import GameBoard from "@/components/board/game-board";
import Button, { buttonClass } from "@/components/button";
import Layout from "@/components/layout";
import PlayerCard from "@/components/player-card";
import { useMatch } from "@/lib/match";
import type { MatchView } from "@/lib/match-view";
import { useGuestSession } from "@/lib/session";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/play/$gameId")({
  ssr: false,
  component: MatchPage,
});

const COLOR_NAMES = { X: "Green", O: "Purple" } as const;

function MatchPage() {
  const { gameId } = Route.useParams();
  const session = useGuestSession();
  const userId = session?.user.id;
  const match = useMatch(gameId, userId);
  const { view, game, seat, error, join } = match;

  // Opening an invite link joins the game.
  const joinable = view?.status === "waiting" && userId && !seat && view.createdBy !== userId;
  useEffect(() => {
    if (joinable && join.isIdle) join.mutate();
  }, [joinable, join]);

  if (error) {
    return (
      <Message title={error}>
        <Link to="/play" className={buttonClass()}>
          Back to lobby
        </Link>
      </Message>
    );
  }
  if (!view) {
    return (
      <Layout>
        <Loader2 className="animate-spin text-neutral-400" />
      </Layout>
    );
  }
  if (view.status === "waiting")
    return (
      <WaitingRoom
        view={view}
        host={view.createdBy === userId}
        cancel={() => match.cancel.mutate()}
      />
    );
  if (view.status === "cancelled") {
    return (
      <Message title="Game cancelled">
        <Link to="/play" className={buttonClass()}>
          Back to lobby
        </Link>
      </Message>
    );
  }

  const playing = view.status === "active";
  const card = (player: Player) => (
    <PlayerCard
      seat={player}
      player={view.players[player]}
      active={playing && game.turn === player}
      you={seat === player}
      delta={view.ratingDelta?.[player]}
    />
  );

  return (
    <Layout>
      <div className="mx-auto mb-6 grid w-full max-w-2xl grid-cols-[1fr_auto_1fr] items-center gap-3">
        {card("X")}
        <span className="text-sm font-semibold text-neutral-400">vs</span>
        {card("O")}
      </div>
      <GameBoard
        key={view.id}
        game={game}
        controls={playing && seat ? [seat] : []}
        onMove={(move) => match.move.mutate(move)}
        status={
          <Status view={view} seat={seat} turn={game.turn} resign={() => match.resign.mutate()} />
        }
      />
    </Layout>
  );
}

function Status({
  view,
  seat,
  turn,
  resign,
}: {
  view: MatchView;
  seat: Player | null;
  turn: Player;
  resign: () => void;
}) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const name = (player: Player) => view.players[player]?.name ?? COLOR_NAMES[player];

  if (view.status === "finished") {
    const headline =
      view.winner === null
        ? "It's a tie!"
        : seat === null
          ? `${name(view.winner)} wins`
          : view.winner === seat
            ? "You win!"
            : "You lose";
    const playAgain = () =>
      void (view.private ? client.arena.invite() : client.arena.quickMatch()).then(({ id }) =>
        navigate({ to: "/play/$gameId", params: { gameId: id } }),
      );
    return (
      <>
        <div className="mt-4 text-center text-4xl font-extrabold tracking-tight sm:text-5xl">
          {headline}
        </div>
        {view.endReason === "resign" && view.winner && (
          <div className="text-gray-500">{name(other(view.winner))} resigned</div>
        )}
        <div className="flex gap-2">
          {seat && (
            <Button onClick={playAgain}>{view.private ? "New invite" : "Play again"}</Button>
          )}
          <Link to="/leaderboard" className={buttonClass({ intent: "secondary" })}>
            Leaderboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <div className="flex items-center gap-3 text-gray-600">
      <span>
        {seat === null
          ? `${name(turn)}'s turn`
          : turn === seat
            ? "Your turn"
            : `Waiting for ${name(turn)}…`}
      </span>
      {seat &&
        (confirming ? (
          <>
            <Button
              intent="secondary"
              className="py-1 text-sm"
              onClick={() => setConfirming(false)}
            >
              Keep playing
            </Button>
            <Button className="py-1 text-sm" onClick={resign}>
              Resign
            </Button>
          </>
        ) : (
          <button
            className="text-sm text-neutral-400 underline hover:text-neutral-600"
            onClick={() => setConfirming(true)}
          >
            Resign
          </button>
        ))}
    </div>
  );
}

function WaitingRoom({
  view,
  host,
  cancel,
}: {
  view: MatchView;
  host: boolean;
  cancel: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "" : window.location.href;
  const copy = () =>
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

  return (
    <Message title={view.private ? "Invite a friend" : "Finding an opponent…"}>
      {view.private ? (
        <div className="flex w-full max-w-md items-center gap-2 rounded-lg bg-white p-2 shadow-sm">
          <input
            readOnly
            value={link}
            className="min-w-0 flex-1 bg-transparent px-2 font-mono text-sm outline-none"
            onFocus={(event) => event.target.select()}
          />
          <Button className="py-1 text-sm" onClick={copy}>
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      ) : (
        <Loader2 className="animate-spin text-neutral-400" />
      )}
      <p className="text-sm text-gray-500">
        {view.private
          ? "The game starts as soon as they open the link."
          : "Keep this page open; the game starts when someone joins."}
      </p>
      {host && (
        <Button intent="secondary" onClick={cancel}>
          Cancel
        </Button>
      )}
    </Message>
  );
}

function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Layout className="container flex flex-col items-center gap-4 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
      {children}
    </Layout>
  );
}
