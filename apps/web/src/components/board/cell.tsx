import { useDroppable } from "@dnd-kit/core";
import type { Piece, Player } from "@thicctactoe/game";
import { cva } from "class-variance-authority";

import { PieceView } from "./piece";

// Phones size cells to the board, which shrinks to fit the screen.
const cell = cva(
  "@container relative grid size-full place-items-center rounded shadow-lg transition-all duration-500 md:size-30",
  {
    variants: {
      isOver: {
        true: "bg-emerald-100",
        false: "bg-white",
      },
      mark: {
        none: "",
        /** Part of the winning line. */
        line: "ring-4 ring-amber-300",
        /** Where the last move was played. */
        last: "ring-4 ring-neutral-300",
      },
      target: {
        true: "cursor-pointer",
        false: "",
      },
    },
  },
);

/** Marks a cell the piece in hand can go to: a dot when empty, a frame when it would cover a piece. */
const hint = cva("pointer-events-none absolute", {
  variants: {
    player: { X: "", O: "" },
    covers: {
      false: "inset-0 m-auto size-[24%] rounded-full",
      true: "inset-0 rounded ring-4 ring-inset",
    },
  },
  compoundVariants: [
    { player: "X", covers: false, className: "bg-emerald-400/50" },
    { player: "O", covers: false, className: "bg-indigo-400/50" },
    { player: "X", covers: true, className: "ring-emerald-400/60" },
    { player: "O", covers: true, className: "ring-indigo-400/60" },
  ],
});

export default function Cell({
  index,
  piece,
  mark,
  target,
  onClick,
}: {
  index: number;
  piece: Piece | null;
  mark: "none" | "line" | "last";
  /** Who can play the piece in hand here, if it may go here. */
  target: Player | null;
  onClick: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: index });
  return (
    <div
      ref={setNodeRef}
      data-cell={index}
      data-target={target ? "" : undefined}
      onClick={target ? onClick : undefined}
      className={cell({ isOver, mark, target: target !== null })}
    >
      {/* The piece comes first: a tapped move flies it in from the tray. */}
      {piece && <PieceView player={piece.player} size={piece.size} fit="cell" />}
      {target && <span className={hint({ player: target, covers: piece !== null })} />}
    </div>
  );
}
