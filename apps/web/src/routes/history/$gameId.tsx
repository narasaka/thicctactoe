import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { type Player, other } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import GameBoard from "@/components/board/game-board";
import { PieceBadge } from "@/components/board/piece";
import { buttonClass } from "@/components/button";
import Layout from "@/components/layout";
import PlayerCard, { piecesUsed } from "@/components/player-card";
import type { MatchView } from "@/lib/match-view";
import { CELL_NAMES, type Replay, buildReplay, formatClock } from "@/lib/replay";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/history/$gameId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Replay | ThiccTacToe" }] }),
  /** `move` is the number of moves played in the shown position; absent means the end. */
  validateSearch: z.object({ move: z.number().int().min(0).optional() }),
  component: ReplayPage,
});

const COLOR_NAMES = { X: "Green", O: "Purple" } as const;

const STEP_MS = 900;

function ReplayPage() {
  const { gameId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: view, isError } = useQuery({
    ...orpc.arena.view.queryOptions({ input: { id: gameId } }),
    retry: false,
  });
  const replay = useMemo(
    () => (view ? buildReplay(view.moves, view.startedAt) : null),
    [view?.moves, view?.startedAt],
  );

  const last = view?.moves.length ?? 0;
  const step = Math.min(search.move ?? last, last);
  const goTo = (move: number) =>
    void navigate({
      search: { move: move >= last ? undefined : Math.max(0, move) },
      replace: true,
    });

  const [autoplay, setAutoplay] = useState(false);
  const playing = autoplay && step < last;
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => goTo(step + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, step]);
  const toggle = () => {
    if (!playing && step >= last) goTo(0);
    setAutoplay(!playing);
  };
  /** Manual stepping takes over from autoplay. */
  const seek = (move: number) => {
    setAutoplay(false);
    goTo(move);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [role=menu]")) return;
      // Space on a focused button presses that button instead.
      if (event.key === " " && target.closest("button")) return;
      const action = {
        ArrowLeft: () => seek(step - 1),
        ArrowRight: () => seek(step + 1),
        Home: () => seek(0),
        End: () => seek(last),
        " ": toggle,
      }[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (isError) {
    return (
      <Message title="Game not found">
        <Link to="/history" className={buttonClass()}>
          Your games
        </Link>
      </Message>
    );
  }
  if (!view || !replay) {
    return (
      <Layout>
        <Loader2 className="animate-spin text-neutral-400" />
      </Layout>
    );
  }
  if (view.status === "waiting" || view.status === "cancelled") {
    return (
      <Message title="This game never started">
        <Link to="/history" className={buttonClass()}>
          Your games
        </Link>
      </Message>
    );
  }

  const game = replay.positions[step]!;
  const ended = view.status === "finished" && step === last;
  const name = (player: Player) => view.players[player]?.name ?? COLOR_NAMES[player];
  const card = (player: Player) => (
    <PlayerCard
      seat={player}
      player={view.players[player]}
      active={!ended && game.turn === player}
      you={view.seat === player}
      used={piecesUsed(game, player)}
      delta={view.ratingDelta?.[player]}
    />
  );

  return (
    <Layout>
      {/* On phones the board takes the height it is given; the move list scrolls in below. */}
      <div className="max-md:h-[min(100svh-6rem,40rem)]">
        <GameBoard
          key={view.id}
          game={game}
          seats={[]}
          locked
          markLastMove
          onMove={() => {}}
          players={{ X: card("X"), O: card("O") }}
          perspective={view.seat ?? undefined}
          status={
            <>
              <div className="flex h-10 items-baseline gap-2">
                {ended ? (
                  <Result view={view} name={name} />
                ) : (
                  <span className="text-gray-600">
                    {step === 0 ? "Start" : `Move ${step} of ${last}`}
                  </span>
                )}
                {view.status === "active" && step === last && (
                  <Link
                    to="/play/$gameId"
                    params={{ gameId: view.id }}
                    className="text-sm text-neutral-500 underline hover:text-neutral-700"
                  >
                    Watch live
                  </Link>
                )}
              </div>
              <Controls step={step} last={last} playing={playing} seek={seek} toggle={toggle} />
            </>
          }
        />
      </div>
      <MoveList
        view={view}
        replay={replay}
        step={step}
        name={name}
        seek={seek}
        className="mx-auto mt-6 w-full max-w-sm"
      />
    </Layout>
  );
}

function Result({ view, name }: { view: MatchView; name: (player: Player) => string }) {
  const { seat, winner } = view;
  const headline =
    winner === null
      ? "It's a tie!"
      : seat === null
        ? `${name(winner)} wins`
        : winner === seat
          ? "You won"
          : "You lost";
  return (
    <>
      <span className="text-3xl font-extrabold tracking-tight whitespace-nowrap sm:text-4xl">
        {headline}
      </span>
      {view.endReason === "resign" && winner && (
        <span className="truncate text-sm text-gray-500">{name(other(winner))} resigned</span>
      )}
    </>
  );
}

const controlClass =
  "grid size-10 place-items-center rounded-lg bg-white text-neutral-700 shadow-sm transition hover:bg-neutral-50 active:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white";

function Controls({
  step,
  last,
  playing,
  seek,
  toggle,
}: {
  step: number;
  last: number;
  playing: boolean;
  seek: (move: number) => void;
  toggle: () => void;
}) {
  const control = (label: string, icon: ReactNode, onClick: () => void, disabled = false) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={controlClass}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
  return (
    <div className="flex h-10 items-center gap-2">
      {control("First move (Home)", <ChevronFirst />, () => seek(0), step === 0)}
      {control("Previous move (←)", <ChevronLeft />, () => seek(step - 1), step === 0)}
      {control(
        playing ? "Pause (Space)" : "Play (Space)",
        playing ? <Pause className="size-5" /> : <Play className="size-5" />,
        toggle,
        last === 0,
      )}
      {control("Next move (→)", <ChevronRight />, () => seek(step + 1), step === last)}
      {control("Last move (End)", <ChevronLast />, () => seek(last), step === last)}
    </div>
  );
}

/** Every move with a scrubber; the current position is highlighted. */
function MoveList({
  view,
  replay,
  step,
  name,
  seek,
  className,
}: {
  view: MatchView;
  replay: Replay;
  step: number;
  name: (player: Player) => string;
  seek: (move: number) => void;
  className?: string;
}) {
  const list = useRef<HTMLOListElement>(null);
  const last = replay.steps.length;

  // Keep the current move in view without scrolling the page.
  useEffect(() => {
    const container = list.current;
    const row = container?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (!container || !row) return;
    if (row.offsetTop < container.scrollTop) container.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > container.scrollTop + container.clientHeight) {
      container.scrollTop = row.offsetTop + row.offsetHeight - container.clientHeight;
    }
  }, [step]);

  const row = (move: number, content: ReactNode, time?: string) => (
    <li key={move} data-step={move}>
      <button
        type="button"
        onClick={() => seek(move)}
        aria-current={move === step ? "step" : undefined}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition",
          move === step ? "bg-neutral-800 text-white" : "hover:bg-neutral-50",
        )}
      >
        <span className="w-5 text-right font-mono text-xs text-neutral-400">
          {move === 0 ? "" : move}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">{content}</span>
        {time && (
          <span
            className={cn(
              "font-mono text-xs",
              move === step ? "text-neutral-300" : "text-neutral-400",
            )}
          >
            {time}
          </span>
        )}
      </button>
    </li>
  );

  return (
    <div className={cn("overflow-hidden rounded-xl bg-white shadow-sm", className)}>
      <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3">
        <input
          type="range"
          aria-label="Position"
          min={0}
          max={last}
          value={step}
          disabled={last === 0}
          onChange={(event) => seek(Number(event.target.value))}
          className="min-w-0 flex-1 accent-neutral-800"
        />
        <span className="w-12 text-right font-mono text-xs text-neutral-500">
          {step}/{last}
        </span>
      </div>
      <ol ref={list} className="relative max-h-72 overflow-y-auto">
        {row(0, <span className="text-neutral-500">Empty board</span>)}
        {replay.steps.map(({ move, covered, elapsedMs }, index) =>
          row(
            index + 1,
            <>
              <PieceBadge player={move.player} size={move.size} title={name(move.player)} />
              <span className="truncate">{CELL_NAMES[move.cell]}</span>
              {covered && (
                <span className="flex items-center gap-1 text-xs opacity-70">
                  covers
                  <PieceBadge
                    player={covered.player}
                    size={covered.size}
                    className="size-5"
                    title={name(covered.player)}
                  />
                </span>
              )}
            </>,
            elapsedMs === null ? undefined : formatClock(elapsedMs),
          ),
        )}
      </ol>
      {view.endReason === "resign" && view.winner && (
        <div className="flex items-center justify-between border-t border-neutral-100 py-2 pr-4 pl-12 text-sm text-neutral-500">
          {name(other(view.winner))} resigned
          {view.finishedAt && view.startedAt && (
            <span className="font-mono text-xs text-neutral-400">
              {formatClock(view.finishedAt.getTime() - view.startedAt.getTime())}
            </span>
          )}
        </div>
      )}
    </div>
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
