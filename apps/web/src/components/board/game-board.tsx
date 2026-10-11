import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { type Game, type Move, type Player, PLAYERS, piecesLeft, play } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";
import { type ReactNode, useState } from "react";

import Cell from "./cell";
import PieceTray from "./piece-tray";
import { type Slot, parseSlotId } from "./tray";

/**
 * Drag-and-drop board for one game. Only legal moves by a `controls` player
 * whose turn it is reach `onMove`. Remount (via `key`) for a fresh game.
 */
export default function GameBoard({
  game,
  controls,
  onMove,
  status,
}: {
  game: Game;
  controls: readonly Player[];
  onMove: (move: Move) => void;
  /** Rendered under the board, e.g. whose turn it is or the result. */
  status?: ReactNode;
}) {
  const [played, setPlayed] = useState<Slot[]>([]);
  const playing = game.outcome.status === "playing";
  const canMove = (player: Player) => playing && game.turn === player && controls.includes(player);
  const line: readonly number[] = game.outcome.status === "won" ? game.outcome.line : [];

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
  const mobileTray = controls.length === 1 ? controls[0] : game.turn;

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid place-items-center gap-8 xl:grid-cols-3">
        {tray("X", "desktop")}
        <div className="grid grid-cols-3 gap-2">
          {game.board.map((piece, cell) => (
            <Cell key={cell} index={cell} piece={piece} highlighted={line.includes(cell)} />
          ))}
        </div>
        {tray("O", "desktop")}
      </div>
      <div className="mt-4 flex flex-col items-center justify-center gap-2">
        {status}
        {playing &&
          PLAYERS.filter((player) => controls.includes(player)).map((player) => (
            <div
              key={player}
              className={cn("w-full transition-all duration-300", {
                "fixed translate-y-full opacity-0": player !== mobileTray,
              })}
            >
              {tray(player, "mobile")}
            </div>
          ))}
      </div>
    </DndContext>
  );
}
