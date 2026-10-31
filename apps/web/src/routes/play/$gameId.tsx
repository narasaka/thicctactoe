import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import type { Player } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";
import { Loader2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import GameBoard from "@/components/board/game-board";
import Button, { buttonClass } from "@/components/button";
import GameOverDialog, { GameOverActions, gameResult } from "@/components/game-over";
import Layout from "@/components/layout";
import PlayerCard, { piecesUsed } from "@/components/player-card";
import SearchStatus from "@/components/search-status";
import SignInButtons from "@/components/sign-in-buttons";
import { playSound } from "@/lib/audio";
import { useMatch } from "@/lib/match";
import type { MatchView } from "@/lib/match-view";
import { useGuestSession } from "@/lib/session";
import { matchSound } from "@/lib/sounds";
import { client } from "@/utils/orpc";

export const Route = createFileRoute("/play/$gameId")({
  ssr: false,
  component: MatchPage,
});

/** Long enough to see the winning line before the result covers the board. */
const GAME_OVER_DELAY_MS = 900;

/** Long enough to read that a player was found, short enough not to keep them waiting. */
const SWITCH_DELAY_MS = 1_200;

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

  const guest = session?.user.isAnonymous ?? false;
  // Opening a matchmade game's link joins it (the host already has a seat). An
  // invite waits for the friend to accept, once they know whether it is rated.
  const joinable = view?.status === "waiting" && !view.private && session && seat === null;
  useEffect(() => {
    if (joinable && join.isIdle) join.mutate();
  }, [joinable, join]);

  const gameOver = useGameOverDialog(view);
  useFollowRematch(view);
  const switching = useFollowSearch(view);
  useMatchSounds(view);

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
  if (view.status === "waiting" && view.private && seat === null) {
    return (
      <Invitation
        view={view}
        guest={guest}
        accepting={!session || join.isPending}
        accept={() => join.mutate()}
      />
    );
  }
  if (view.status === "waiting") {
    return <WaitingRoom view={view} cancel={() => match.cancel.mutate()} />;
  }
  if (view.status === "cancelled" && switching) {
    return (
      <Message title="Player found!">
        <Loader2 className="animate-spin text-neutral-400" />
        <p className="text-sm text-gray-500">Switching you to your match…</p>
      </Message>
    );
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
        locked={!playing || switching}
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
        guest={guest}
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
 * Moves a player who is playing the bot on to their match as soon as someone
 * joins it. Opening an old bot game whose match was found long ago stays put.
 */
function useFollowSearch(view: MatchView | null) {
  const navigate = useNavigate();
  const [watched, setWatched] = useState(false);
  if (view?.search?.found === false && !watched) setWatched(true);
  const next = watched && view?.search?.found ? view.search.id : null;

  useEffect(() => {
    if (!next) return;
    const timer = setTimeout(
      () => void navigate({ to: "/play/$gameId", params: { gameId: next } }),
      SWITCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [next, navigate]);
  return next !== null;
}

/** Sounds for what the board does not show: an opponent arriving, or someone resigning or leaving. */
function useMatchSounds(view: MatchView | null) {
  const previous = useRef(view);
  useEffect(() => {
    if (view === previous.current) return;
    const sound = previous.current && view && matchSound(previous.current, view);
    if (sound) playSound(sound);
    previous.current = view;
  });
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
          <span className="text-2xl font-pixel whitespace-nowrap">{headline}</span>
          <span className="truncate text-sm text-gray-500">{reason}</span>
          {view.search && <SearchStatus search={view.search} className="self-center" />}
        </div>
        <GameOverActions view={view} rematch={rematch} variant="inline" />
      </>
    );
  }

  return (
    <div className="flex h-10 w-full items-center justify-between gap-2">
      <span className="font-semibold text-gray-700">{turn === seat && "Your turn"}</span>
      {view.search && <SearchStatus search={view.search} />}
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
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  // The player stays in the queue while they play, and is moved on once someone joins.
  const playBot = useMutation({
    mutationFn: () =>
      client.arena
        .playBot({ id: view.id })
        .then(({ id }) => navigate({ to: "/play/$gameId", params: { gameId: id } })),
    onError: (error) => toast.error(error.message),
  });
  const link = typeof window === "undefined" ? "" : window.location.href;
  const copy = () =>
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

  return (
    <Message title={view.private ? "Invite a friend" : "Searching for players…"}>
      {view.private && <RatedTag rated={view.rated} />}
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
          ? `Send them the link; the game starts once they accept. ${RATED_NOTE[`${view.rated}`]}`
          : "Keep this page open; the game starts when someone joins. Play our bot meanwhile, and we'll switch you over when they do."}
      </p>
      {view.seat && (
        <div className="flex flex-col gap-2 md:flex-row">
          {!view.private && (
            <Button disabled={playBot.isPending} onClick={() => playBot.mutate()}>
              Play a bot while you wait
            </Button>
          )}
          <Button intent="secondary" onClick={cancel}>
            Cancel
          </Button>
        </div>
      )}
    </Message>
  );
}

const RATED_NOTE = {
  true: "The result counts towards both players' ratings.",
  false: "Nobody's rating changes.",
} as const;

/** What a friend sees when they open an invite link: the kind of game, before they join it. */
function Invitation({
  view,
  guest,
  accepting,
  accept,
}: {
  view: MatchView;
  guest: boolean;
  accepting: boolean;
  accept: () => void;
}) {
  const host = view.players.X ?? view.players.O;
  return (
    <Message title="You're invited">
      <RatedTag rated={view.rated} />
      <p className="max-w-sm text-gray-500">
        <span className="font-semibold text-gray-700">{host?.name ?? "A friend"}</span> invited you
        to {view.rated ? "a rated" : "an unrated"} game. {RATED_NOTE[`${view.rated}`]}
      </p>
      {view.rated && guest ? (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <p className="font-semibold">Sign in to accept: rated games are for signed-in players.</p>
          <SignInButtons />
        </div>
      ) : (
        <Button disabled={accepting} onClick={accept}>
          Accept
        </Button>
      )}
    </Message>
  );
}

function RatedTag({ rated }: { rated: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide uppercase",
        rated ? "bg-amber-100 text-amber-800" : "bg-neutral-200 text-neutral-600",
      )}
    >
      {rated ? "Rated" : "Unrated"}
    </span>
  );
}

function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Layout className="container flex flex-col items-center gap-4 text-center">
      <h1 className="text-4xl font-pixel sm:text-5xl">{title}</h1>
      {children}
    </Layout>
  );
}
