import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { type Player, other } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import GameBoard from "@/components/board/game-board";
import Button, { buttonClass } from "@/components/button";
import Layout from "@/components/layout";
import PlayerCard from "@/components/player-card";
import SignInNudge from "@/components/sign-in-nudge";
import { useMatch } from "@/lib/match";
import type { MatchView } from "@/lib/match-view";
import { useGuestSession } from "@/lib/session";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/play/$gameId")({
  ssr: false,
  component: MatchPage,
});

const COLOR_NAMES = { X: "Green", O: "Purple" } as const;

/** Long enough to take in the final board before the nudge covers it. */
const NUDGE_DELAY_MS = 1500;

function MatchPage() {
  const { gameId } = Route.useParams();
  const session = useGuestSession();
  const match = useMatch(gameId, session?.user.id);
  const { view, game, seat, error, join } = match;

  // Opening an invite link joins the game (the host already has a seat).
  const joinable = view?.status === "waiting" && session && seat === null;
  useEffect(() => {
    if (joinable && join.isIdle) join.mutate();
  }, [joinable, join]);

  const nudge = useSignInNudge(view, session?.user.isAnonymous ?? false);

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
  if (view.status === "waiting") {
    return <WaitingRoom view={view} cancel={() => match.cancel.mutate()} />;
  }
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
        seats={seat ? [seat] : []}
        locked={!playing}
        onMove={(move) => match.move.mutate(move)}
        status={<Status view={view} turn={game.turn} resign={() => match.resign.mutate()} />}
      />
      {seat && view.players[seat] && (
        <SignInNudge
          open={nudge.open}
          onOpenChange={nudge.setOpen}
          player={view.players[seat]}
          result={view.winner === null ? "tie" : view.winner === seat ? "win" : "loss"}
          delta={view.ratingDelta?.[seat]}
        />
      )}
    </Layout>
  );
}

/**
 * Opens once a guest finishes a game they watched being played, to get them
 * onto the leaderboard. Revisiting an old game does not nag.
 */
function useSignInNudge(view: MatchView | null, guest: boolean) {
  const [open, setOpen] = useState(false);
  const [watched, setWatched] = useState<string | null>(null);
  if (view?.status === "active" && watched !== view.id) setWatched(view.id);
  const due = guest && view?.status === "finished" && view.seat !== null && watched === view.id;

  useEffect(() => {
    if (!due) return;
    const timer = setTimeout(() => setOpen(true), NUDGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [due]);

  return { open: open && guest, setOpen };
}

/**
 * Two fixed rows inside the board's fixed-height status area, so switching
 * between turn, resign confirmation and result never moves anything.
 */
function Status({ view, turn, resign }: { view: MatchView; turn: Player; resign: () => void }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const { seat } = view;
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
        <div className="flex h-10 items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight whitespace-nowrap sm:text-4xl">
            {headline}
          </span>
          {view.endReason === "resign" && view.winner && (
            <span className="truncate text-sm text-gray-500">
              {name(other(view.winner))} resigned
            </span>
          )}
        </div>
        <div className="flex h-10 gap-2">
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
    <>
      <div className="flex h-10 items-center text-gray-600">
        {seat === null
          ? `${name(turn)}'s turn`
          : turn === seat
            ? "Your turn"
            : `Waiting for ${name(turn)}…`}
      </div>
      <div className={cn("flex h-10 items-center gap-2", !seat && "invisible")} inert={!seat}>
        {confirming ? (
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
        )}
      </div>
    </>
  );
}

function WaitingRoom({ view, cancel }: { view: MatchView; cancel: () => void }) {
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
          <Button className="w-24 py-1 text-sm" onClick={copy}>
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
      {view.seat && (
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
