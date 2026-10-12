import { useDroppable } from "@dnd-kit/core";
import type { Piece } from "@thicctactoe/game";
import { cva } from "class-variance-authority";

import { PieceView } from "./piece";

const cell = cva(
  "grid size-24 place-items-center rounded shadow-lg transition-all duration-500 sm:size-30",
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
    },
  },
);

export default function Cell({
  index,
  piece,
  mark,
}: {
  index: number;
  piece: Piece | null;
  mark: "none" | "line" | "last";
}) {
  const { isOver, setNodeRef } = useDroppable({ id: index });
  return (
    <div ref={setNodeRef} className={cell({ isOver, mark })}>
      {piece && <PieceView player={piece.player} size={piece.size} />}
    </div>
  );
}
