import { Link, useNavigate } from "@tanstack/react-router";
import { PAIR_RATING_CAP } from "@thicctactoe/api/rating";
import { PLAYERS, type Player, other } from "@thicctactoe/game";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@thicctactoe/ui/components/dialog";
import { cn } from "@thicctactoe/ui/lib/utils";
import { Crown, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { type MatchView, againstBot } from "@/lib/match-view";
import { client } from "@/utils/orpc";

import Avatar from "./avatar";
import BotTag from "./bot-tag";
import Button, { buttonClass } from "./button";
import SearchStatus from "./search-status";
import SignInButtons from "./sign-in-buttons";

const COLOR_NAMES = { X: "Green", O: "Purple" } as const;
const SEAT_RING = { X: "ring-emerald-400", O: "ring-indigo-400" } as const;

const GUEST_PITCH = {
  win: "Make your next win count",
  loss: "Climb the leaderboard",
  tie: "Climb the leaderboard",
} as const;

/** "You win!" and how it happened, from the viewer's side of the board. */
export function gameResult(view: MatchView) {
  const { seat, winner } = view;
  const name = (player: Player) =>
    player === seat ? "You" : (view.players[player]?.name ?? COLOR_NAMES[player]);
  const headline =
    winner === null
      ? "It's a tie!"
      : seat === null
        ? `${name(winner)} wins`
        : winner === seat
          ? "You win!"
          : "You lose";
  const ending =
    view.endReason === "resign" && winner
      ? `${name(other(winner))} resigned`
      : view.endReason === "abandon" && winner
        ? `${name(other(winner))} left`
        : view.endReason === "draw"
          ? "No moves left"
          : "Three in a row";
  // Unrated friend games, guests' games and games resigned before they began.
  const reason = view.ratingDelta === null ? `${ending} · Unrated` : ending;
  return { headline, reason: view.ratingCapped ? `${ending} · Rating capped` : reason };
}

/** Why the game moved less rating than usual, or none, when the cap between two players kicked in. */
function ratingCapNote(view: MatchView) {
  const who = view.seat
    ? "you've played this opponent a lot today"
    : "these players have played each other a lot today";
  const effect =
    view.ratingDelta === null ? "This game is unrated." : "This game counted for less than usual.";
  return {
    title: `Rating capped: ${who}`,
    detail: `${effect} One player can gain at most ${PAIR_RATING_CAP} rating, net, from the same opponent over the past 24 hours.`,
  };
}

/**
 * What to do once a game is over: rematch first, then a new game or the
 * replay. The same buttons appear in the game-over dialog and, once it is
 * closed, under the board.
 */
export function GameOverActions({
  view,
  rematch,
  variant,
}: {
  view: MatchView;
  rematch: () => void;
  variant: "dialog" | "inline";
}) {
  const navigate = useNavigate();
  const inline = variant === "inline";
  const secondary = buttonClass({
    intent: "secondary",
    className: cn("text-center whitespace-nowrap", inline && "px-3 text-sm"),
  });
  // A new game after the bot goes back to looking for a person.
  const playAgain = () =>
    void (
      view.private && !againstBot(view)
        ? client.arena.invite({ rated: view.rated })
        : client.arena.quickMatch()
    )
      .then(({ id }) => navigate({ to: "/play/$gameId", params: { gameId: id } }))
      .catch((error: Error) => toast.error(error.message));

  return (
    <div className={cn(inline ? "flex h-10 items-center gap-2" : "flex flex-col gap-2")}>
      <RematchAction
        view={view}
        rematch={rematch}
        className={inline ? "px-3 text-sm" : "py-3 text-lg short:py-2"}
      />
      <div className={cn(inline ? "contents" : "grid grid-cols-2 gap-2")}>
        {view.seat ? (
          <button type="button" className={secondary} onClick={playAgain}>
            New game
          </button>
        ) : (
          <Link to="/leaderboard" className={secondary}>
            Leaderboard
          </Link>
        )}
        <Link
          to="/history/$gameId"
          params={{ gameId: view.id }}
          search={{ move: 0 }}
          className={secondary}
        >
          Replay
        </Link>
      </div>
    </div>
  );
}

/** Offer a rematch, accept one, or follow it once agreed. */
function RematchAction({
  view,
  rematch,
  className,
}: {
  view: MatchView;
  rematch: () => void;
  className: string;
}) {
  const style = cn("flex items-center justify-center gap-2 whitespace-nowrap", className);
  if (view.rematchId) {
    return (
      <Link
        to="/play/$gameId"
        params={{ gameId: view.rematchId }}
        className={buttonClass({ className: style })}
      >
        {view.seat ? "Go to rematch" : "Watch rematch"}
      </Link>
    );
  }
  if (!view.seat) return null;
  const sent = view.rematchOffer === view.seat;
  return (
    <Button onClick={rematch} disabled={sent} className={style}>
      {sent && <Loader2 className="size-4 animate-spin" />}
      {sent ? "Rematch sent" : view.rematchOffer ? "Accept rematch" : "Rematch"}
    </Button>
  );
}

/**
 * The result of a game that just ended, over the board, chess.com style.
 * Guests also get asked to sign in, so the game carries over to an account
 * that plays rated games and shows up on the leaderboard.
 */
export default function GameOverDialog({
  view,
  open,
  onOpenChange,
  guest,
  rematch,
}: {
  view: MatchView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest: boolean;
  rematch: () => void;
}) {
  const { headline, reason } = gameResult(view);
  const { seat, winner } = view;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-2xl bg-white p-0 text-base shadow-xl ring-0 sm:max-w-sm"
      >
        <div className="relative bg-neutral-900 px-12 pt-6 pb-5 text-center short:pt-4 short:pb-3">
          {/* Spectators read a name, not "You", so it gets more room. */}
          <DialogTitle
            className={cn("font-pixel text-balance text-white", seat ? "text-3xl" : "text-2xl")}
          >
            {headline}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-neutral-400">{reason}</DialogDescription>
          {view.search && <SearchStatus search={view.search} className="mt-2 justify-center" />}
        </div>
        <div className="flex items-start justify-center gap-2 px-6 pt-6 short:pt-4">
          {PLAYERS.map((player) => (
            <div key={player} className="contents">
              {player === "O" && (
                <span className="mt-5 text-sm font-semibold text-neutral-400">vs</span>
              )}
              <Contender view={view} player={player} won={winner === player} />
            </div>
          ))}
        </div>
        {view.ratingCapped && <RatingCapNote view={view} />}
        <div className="p-6 short:p-4">
          <GameOverActions view={view} rematch={rematch} variant="dialog" />
        </div>
        {guest && seat && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-5 text-center short:py-4">
            <p className="font-semibold">
              {GUEST_PITCH[winner === null ? "tie" : winner === seat ? "win" : "loss"]}
            </p>
            <p className="mt-1 text-sm text-gray-500 short:hidden">
              Guest games are unrated. Sign in to keep this game and play rated games against other
              signed-in players.
            </p>
            <SignInButtons className="mt-4 short:mt-3" />
          </div>
        )}
        {/* Last in tab order: focus starts on the actions, not on dismissing them. */}
        <DialogClose
          aria-label="Close"
          className="absolute top-3 right-3 grid size-8 place-items-center rounded-lg text-neutral-400 transition outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <X className="size-5" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function RatingCapNote({ view }: { view: MatchView }) {
  const { title, detail } = ratingCapNote(view);
  return (
    <div className="mx-6 mt-5 rounded-lg bg-amber-50 px-4 py-3 text-center text-sm short:mt-3 short:py-2">
      <p className="font-semibold text-amber-900">{title}</p>
      <p className="mt-0.5 text-amber-800">{detail}</p>
    </div>
  );
}

function Contender({ view, player, won }: { view: MatchView; player: Player; won: boolean }) {
  const profile = view.players[player];
  const delta = view.ratingDelta?.[player];
  return (
    <div className="flex w-32 min-w-0 flex-col items-center text-center">
      <div className="relative">
        <Avatar
          name={profile?.name ?? "?"}
          image={profile?.image}
          bot={profile?.bot}
          className={cn(
            "size-14 ring-4 short:size-11",
            won ? SEAT_RING[player] : "ring-transparent",
          )}
        />
        {won && (
          <span className="absolute -top-2.5 -right-2.5 grid size-7 place-items-center rounded-full border-2 border-white bg-amber-400 text-white shadow-sm">
            <Crown className="size-3.5" fill="currentColor" />
          </span>
        )}
      </div>
      <div className="mt-2 w-full truncate text-sm font-semibold">
        {profile?.name ?? COLOR_NAMES[player]}
      </div>
      <div className="flex gap-1 text-xs text-neutral-500">
        {profile?.bot ? <BotTag /> : profile?.rating}
        {delta !== undefined && (
          <span className={delta >= 0 ? "text-emerald-600" : "text-rose-600"}>
            {delta >= 0 ? `+${delta}` : delta}
          </span>
        )}
        {view.seat === player && <span className="text-neutral-400">· you</span>}
      </div>
    </div>
  );
}
