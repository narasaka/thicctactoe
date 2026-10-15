import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type Game, type Move, type Player, PLAYERS, piecesLeft, play } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

import { playSound, playSounds } from "@/lib/audio";
import { moveSounds } from "@/lib/sounds";

import Cell from "./cell";
import PieceTray from "./piece-tray";
import { type Slot, parseSlotId } from "./tray";

/** How long a tapped move takes to glide from the tray to its cell. */
const FLIGHT_MS = 250;

/** A tapped move on its way to the board: where its piece left the tray. */
type Flight = { cell: number; moves: number; from: DOMRect };

/**
 * Board for one game. A piece moves by dragging it onto a cell, or by
 * tapping it and then one of the cells it can go to, chess-app style. Only legal moves by one of the viewer's
 * `seats`, on its turn, reach `onMove`. Remount (via `key`) for a fresh game.
 *
 * Every region has a fixed size for the whole game (trays keep empty slots,
 * the status area and mobile tray are always reserved), so nothing shifts as
 * the game progresses or ends.
 *
 * On phones it fills its parent's height, chess-app style: opponent on top,
 * the board shrinking to whatever height is left, then you and your tray.
 * Give it a definite height there.
 */
export default function GameBoard({
  game,
  seats,
  locked = false,
  markLastMove = false,
  onMove,
  status,
  players,
  perspective = seats.length === 1 ? seats[0] : "X",
}: {
  game: Game;
  /** Seats the viewer plays: both for local games, none for spectators. */
  seats: readonly Player[];
  /** Disallow moves regardless of the rules, e.g. once an online game has ended. */
  locked?: boolean;
  /** Outline the cell of the most recent move, e.g. when replaying. */
  markLastMove?: boolean;
  onMove: (move: Move) => void;
  /**
   * Rendered in a fixed-height area under the board. Must fit in h-24, and
   * on phones in one h-10 row while the game is on (the tray sits above it).
   */
  status?: ReactNode;
  /** Each player's card, placed next to their tray. */
  players?: Record<Player, ReactNode>;
  /** Who sits at the bottom on phones: your seat, or green for everyone else. */
  perspective?: Player;
}) {
  const [played, setPlayed] = useState<Slot[]>([]);
  // The piece in hand, by slot id: tapped, or being dragged.
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const flight = useRef<Flight | null>(null);
  const playing = game.outcome.status === "playing" && !locked;
  const canMove = (player: Player) => playing && game.turn === player && seats.includes(player);
  const line: readonly number[] = game.outcome.status === "won" ? game.outcome.line : [];
  const last = markLastMove ? game.moves.at(-1)?.cell : undefined;

  const inHand = dragging ?? selected;
  const held = inHand === null ? null : parseSlotId(inHand);
  const targetFor = (cell: number) =>
    held && canMove(held.player) && play(game, { player: held.player, size: held.size, cell }).ok
      ? held.player
      : null;

  // A press only turns into a drag once the pointer moves, so a tap stays a tap.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Every move sounds, whoever made it: yours as it lands, the opponent's
  // as it arrives, a replay's as it steps forward.
  const previous = useRef(game);
  useLayoutEffect(() => {
    if (game === previous.current) return;
    const tapped = flight.current;
    flight.current = null;
    const landing =
      tapped?.moves === game.moves.length && boardRef.current
        ? fly(boardRef.current, tapped.cell, tapped.from)
        : 0;
    playSounds(moveSounds(previous.current, game, seats), landing / 1000);
    previous.current = game;
  });

  // Tapping anywhere but a piece or a cell it can go to puts it back.
  useEffect(() => {
    if (selected === null) return;
    const deselect = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-piece], [data-target]")) {
        return;
      }
      setSelected(null);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setSelected(null);
    document.addEventListener("click", deselect);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", deselect);
      document.removeEventListener("keydown", escape);
    };
  }, [selected]);

  /** Plays the piece in slot `id` on `cell`, if the rules allow it. */
  const place = (id: string, cell: number) => {
    const slot = parseSlotId(id);
    const move = { player: slot.player, size: slot.size, cell };
    if (!canMove(move.player)) return false;
    if (!play(game, move).ok) {
      playSound({ type: "nope" });
      return false;
    }
    setPlayed((prev) => [...prev, slot]);
    onMove(move);
    return true;
  };

  const handleSelect = (id: string) => {
    const slot = parseSlotId(id);
    if (id === selected || !canMove(slot.player)) return setSelected(null);
    playSound({ type: "pickup", size: slot.size });
    setSelected(id);
  };

  const handleCellClick = (cell: number) => {
    if (selected === null) return;
    // Measure the piece before it leaves the tray, to fly it from there.
    const from = document
      .querySelector(`[data-piece="${selected}"]`)
      ?.firstElementChild?.getBoundingClientRect();
    // Whether it lands or not, the piece leaves the hand: a cell it can't go
    // to gets the same "nope" as dropping it there.
    setSelected(null);
    flight.current = from ? { cell, moves: game.moves.length + 1, from } : null;
    if (!place(selected, cell)) flight.current = null;
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setSelected(null);
    setDragging(String(active.id));
    playSound({ type: "pickup", size: parseSlotId(String(active.id)).size });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (over !== null) place(String(active.id), Number(over.id));
  };

  const tray = (player: Player, variant: "desktop" | "mobile") => (
    <PieceTray
      variant={variant}
      player={player}
      left={piecesLeft(game, player)}
      played={played}
      disabled={!canMove(player)}
      selected={selected}
      onSelect={handleSelect}
    />
  );
  // On phones there is room for one tray: whoever's turn it is in a local
  // game, otherwise the one under the bottom player's card.
  const mobileTray = seats.length === 2 ? game.turn : perspective;

  return (
    // Auto-scroll is off: a drag must never move the page under the player.
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
      autoScroll={false}
    >
      <div
        className={cn(
          "grid h-full content-center items-center justify-items-center gap-x-8 gap-y-3",
          // Phones: opponent, board, you, then the dock with your tray and the status.
          // The board's row gives way first when the screen is short.
          "grid-rows-[auto_minmax(0,auto)_auto_7rem] [grid-template-areas:'top'_'board'_'bottom'_'dock']",
          // Tablet: board, status, then each player's card over their tray.
          "md:h-auto md:grid-rows-none md:gap-y-4 md:[grid-template-areas:'board_board'_'status_status'_'x-card_o-card'_'x_o']",
          // Wide: players beside the board.
          "wide:[grid-template-areas:'x-card_board_o-card'_'x_board_o'_'._status_.']",
        )}
      >
        {players &&
          PLAYERS.map((player) => (
            <div
              key={player}
              className={cn(
                "w-full self-stretch md:self-auto",
                player === perspective ? "[grid-area:bottom]" : "[grid-area:top]",
                player === "X" ? "md:[grid-area:x-card]" : "md:[grid-area:o-card]",
                "wide:self-end",
              )}
            >
              {players[player]}
            </div>
          ))}
        <div className="hidden [grid-area:x] md:block wide:self-start">{tray("X", "desktop")}</div>
        {/* A size container, so the board can be the largest square that fits. */}
        <div
          ref={boardRef}
          className="grid h-[min(100vw-2rem,28rem)] max-h-full w-full place-items-center [container-type:size] [grid-area:board] md:size-auto md:max-h-none md:[container-type:normal]"
        >
          <div className="grid size-[min(100cqw,100cqh)] grid-cols-3 grid-rows-3 gap-2 md:size-auto">
            {game.board.map((piece, cell) => (
              <Cell
                key={cell}
                index={cell}
                piece={piece}
                mark={line.includes(cell) ? "line" : cell === last ? "last" : "none"}
                target={targetFor(cell)}
                onClick={() => handleCellClick(cell)}
              />
            ))}
          </div>
        </div>
        <div className="hidden [grid-area:o] md:block wide:self-start">{tray("O", "desktop")}</div>
        <div className="flex w-full flex-col items-center justify-center gap-2 self-end [grid-area:dock] md:h-24 md:w-94 md:self-auto md:[grid-area:status]">
          {status}
        </div>
        {/* Both trays share one grid cell, so switching between them keeps the space. */}
        <div
          inert={!playing}
          className={cn(
            "grid w-full self-start transition-opacity duration-300 [grid-area:dock] md:hidden",
            !playing && "opacity-0",
          )}
        >
          {PLAYERS.map((player) => (
            <div
              key={player}
              inert={player !== mobileTray}
              className={cn(
                "col-start-1 row-start-1 transition-all duration-300",
                player !== mobileTray && "translate-y-4 opacity-0",
              )}
            >
              {tray(player, "mobile")}
            </div>
          ))}
        </div>
      </div>
    </DndContext>
  );
}

/**
 * Glides the piece just played on `cell` in from `from`, where it sat in the
 * tray. Returns how long that takes, in milliseconds.
 */
function fly(board: HTMLElement, cell: number, from: DOMRect) {
  const target = board.querySelector<HTMLElement>(`[data-cell="${cell}"]`);
  const piece = target?.firstElementChild;
  if (!target || !piece || matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  const to = piece.getBoundingClientRect();
  const x = from.left + from.width / 2 - (to.left + to.width / 2);
  const y = from.top + from.height / 2 - (to.top + to.height / 2);
  // The board and the cell are stacking contexts: lift both so the piece
  // passes over the other cells, cards and trays on its way in.
  const lifted = [board, target];
  for (const element of lifted) element.style.zIndex = "10";
  const animation = piece.animate(
    [
      { transform: `translate(${x}px, ${y}px) scale(${from.width / to.width})` },
      { transform: "none" },
    ],
    { duration: FLIGHT_MS, easing: "cubic-bezier(0.2, 0, 0, 1)" },
  );
  animation.onfinish = animation.oncancel = () => {
    for (const element of lifted) element.style.removeProperty("z-index");
  };
  return FLIGHT_MS;
}
