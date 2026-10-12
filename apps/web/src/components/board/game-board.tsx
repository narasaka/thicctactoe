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
  // On phones there is room for one tray: whoever's turn it is in a local
  // game, otherwise the one under the bottom player's card.
  const mobileTray = seats.length === 2 ? game.turn : perspective;

  return (
    // Auto-scroll is off: a drag must never move the page under the player.
    <DndContext onDragEnd={handleDragEnd} autoScroll={false}>
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
        <div className="grid h-[min(100vw-2rem,28rem)] max-h-full w-full place-items-center [container-type:size] [grid-area:board] md:size-auto md:max-h-none md:[container-type:normal]">
          <div className="grid size-[min(100cqw,100cqh)] grid-cols-3 grid-rows-3 gap-2 md:size-auto">
            {game.board.map((piece, cell) => (
              <Cell
                key={cell}
                index={cell}
                piece={piece}
                mark={line.includes(cell) ? "line" : cell === last ? "last" : "none"}
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
