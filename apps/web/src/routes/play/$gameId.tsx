import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Player } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import GameBoard from "@/components/board/game-board";
import Button, { buttonClass } from "@/components/button";
import GameOverDialog, { GameOverActions, gameResult } from "@/components/game-over";
import Layout from "@/components/layout";
import PlayerCard, { piecesUsed } from "@/components/player-card";
import { useMatch } from "@/lib/match";
import type { MatchView } from "@/lib/match-view";
import { useGuestSession } from "@/lib/session";

export const Route = createFileRoute("/play/$gameId")({
  ssr: false,
  component: MatchPage,
});

/** Long enough to see the winning line before the result covers the board. */
const GAME_OVER_DELAY_MS = 900;

/** A quiet text action, for resigning. */
const TEXT_LINK = "text-sm whitespace-nowrap text-neutral-400 underline hover:text-neutral-600";

function MatchPage() {
  const { gameId } = Route.useParams();
  // A rematch is a new game: start its page from scratch.
  return <Match key={gameId} gameId={gameId} />;
}

function Match({ gameId }: { gameId: string }) {
  const session = useGuestSession();
  const match = useMatch(gameId, session?.user.id);
  const { view, game, seat, error, join } = match;

  // Opening an invite link joins the game (the host already has a seat).
  const joinable = view?.status === "waiting" && session && seat === null;
  useEffect(() => {
    if (joinable && join.isIdle) join.mutate();
  }, [joinable, join]);

  const gameOver = useGameOverDialog(view);
  useFollowRematch(view);

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
      used={piecesUsed(game, player)}
      delta={view.ratingDelta?.[player]}
      callout={view.rematchOffer === player ? "Rematch?" : undefined}
    />
  );

  return (
    <Layout fit>
      <GameBoard
        key={view.id}
        game={game}
        seats={seat ? [seat] : []}
        locked={!playing}
        onMove={(move) => match.move.mutate(move)}
        players={{ X: card("X"), O: card("O") }}
        status={
          <Status
            view={view}
            turn={game.turn}
            resign={() => match.resign.mutate()}
            rematch={() => match.rematch.mutate()}
          />
        }
      />
      <GameOverDialog
        view={view}
        open={gameOver.open}
        onOpenChange={gameOver.setOpen}
        guest={session?.user.isAnonymous ?? false}
        rematch={() => match.rematch.mutate()}
      />
    </Layout>
  );
}

/**
 * Opens once a game everyone watched being played ends. Revisiting an old
 * game does not pop it up again.
 */
function useGameOverDialog(view: MatchView | null) {
  const [open, setOpen] = useState(false);
  const [watched, setWatched] = useState<string | null>(null);
  if (view?.status === "active" && watched !== view.id) setWatched(view.id);
  const due = view?.status === "finished" && watched === view.id;

  useEffect(() => {
    if (!due) return;
    const timer = setTimeout(() => setOpen(true), GAME_OVER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [due]);

  return { open, setOpen };
}

/**
 * Moves everyone watching on to the rematch as soon as it is agreed. Opening
 * an old game whose rematch was played long ago stays put.
 */
function useFollowRematch(view: MatchView | null) {
  const navigate = useNavigate();
  const [watched, setWatched] = useState(false);
  if (view?.status === "finished" && view.rematchId === null && !watched) setWatched(true);
  const next = watched ? view?.rematchId : null;

  useEffect(() => {
    if (next) void navigate({ to: "/play/$gameId", params: { gameId: next } });
  }, [next, navigate]);
}

/**
 * Fits the board's fixed-height status area: one row while playing (whose
 * turn it is shows on the player cards), two once the game is over, so
 * switching between turn, resign confirmation and result never moves anything.
 */
function Status({
  view,
  turn,
  resign,
  rematch,
}: {
  view: MatchView;
  turn: Player;
  resign: () => void;
  rematch: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { seat } = view;

  if (view.status === "finished") {
    const { headline, reason } = gameResult(view);
    return (
      <>
        <div className="flex h-10 items-baseline gap-2">
          <span className="text-2xl font-extrabold tracking-tight whitespace-nowrap">
            {headline}
          </span>
          <span className="truncate text-sm text-gray-500">{reason}</span>
        </div>
        <GameOverActions view={view} rematch={rematch} variant="inline" />
      </>
    );
  }

  return (
    <div className="flex h-10 w-full items-center justify-between gap-2">
      <span className="font-semibold text-gray-700">{turn === seat && "Your turn"}</span>
      <div className={cn("flex items-center gap-2", !seat && "invisible")} inert={!seat}>
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
          <button className={TEXT_LINK} onClick={() => setConfirming(true)}>
            Resign
          </button>
        )}
      </div>
    </div>
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
