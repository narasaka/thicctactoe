import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { type Game, type Move, type Player, PLAYERS, piecesLeft, play } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";
import { type ReactNode, useState } from "react";

import Cell from "./cell";
import PieceTray from "./piece-tray";
import { type Slot, parseSlotId } from "./tray";

/**
 * Drag-and-drop board for one game. Only legal moves by one of the viewer's
 * `seats`, on its turn, reach `onMove`. Remount (via `key`) for a fresh game.
 *
 * Every region has a fixed size for the whole game (trays keep empty slots,
 * the status area and mobile tray are always reserved), so nothing shifts as
 * the game progresses or ends.
 */
export default function GameBoard({
  game,
  seats,
  locked = false,
  markLastMove = false,
  onMove,
  status,
}: {
  game: Game;
  /** Seats the viewer plays: both for local games, none for spectators. */
  seats: readonly Player[];
  /** Disallow moves regardless of the rules, e.g. once an online game has ended. */
  locked?: boolean;
  /** Outline the cell of the most recent move, e.g. when replaying. */
  markLastMove?: boolean;
  onMove: (move: Move) => void;
  /** Rendered in a fixed-height area under the board. Must fit in h-24. */
  status?: ReactNode;
}) {
  const [played, setPlayed] = useState<Slot[]>([]);
  const playing = game.outcome.status === "playing" && !locked;
  const canMove = (player: Player) => playing && game.turn === player && seats.includes(player);
  const line: readonly number[] = game.outcome.status === "won" ? game.outcome.line : [];
  const last = markLastMove ? game.moves.at(-1)?.cell : undefined;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over === null) return;
    const slot = parseSlotId(String(active.id));
    const move = { player: slot.player, size: slot.size, cell: Number(over.id) };
    if (!canMove(move.player) || !play(game, move).ok) return;
    setPlayed((prev) => [...prev, slot]);
    onMove(move);
  };

  const tray = (player: Player, variant: "desktop" | "mobile") => (
    <PieceTray
      variant={variant}
      player={player}
      left={piecesLeft(game, player)}
      played={played}
      disabled={!canMove(player)}
    />
  );
  // On mobile there is room for one tray: yours, or whoever's turn it is.
  const mobileTray = seats.length === 1 ? seats[0] : game.turn;

  return (
    // Auto-scroll is off: a drag must never move the page under the player.
    <DndContext onDragEnd={handleDragEnd} autoScroll={false}>
      <div
        className={cn(
          "grid items-center justify-items-center gap-x-8 gap-y-4",
          // Mobile: board, status, then the one tray that fits.
          "[grid-template-areas:'board'_'status'_'tray']",
          // Tablet: board, status, then both trays side by side.
          "md:[grid-template-areas:'board_board'_'status_status'_'x_o']",
          // Wide: trays beside the board.
          "wide:[grid-template-areas:'x_board_o'_'._status_.']",
        )}
      >
        <div className="hidden [grid-area:x] md:block">{tray("X", "desktop")}</div>
        <div className="grid grid-cols-3 gap-2 [grid-area:board]">
          {game.board.map((piece, cell) => (
            <Cell
              key={cell}
              index={cell}
              piece={piece}
              mark={line.includes(cell) ? "line" : cell === last ? "last" : "none"}
            />
          ))}
        </div>
        <div className="hidden [grid-area:o] md:block">{tray("O", "desktop")}</div>
        <div className="flex h-24 flex-col items-center justify-center gap-2 [grid-area:status]">
          {status}
        </div>
        {/* Both trays share one grid cell, so switching between them keeps the space. */}
        <div className="grid w-full [grid-area:tray] md:hidden">
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
