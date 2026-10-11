import { useDroppable } from "@dnd-kit/core";
import type { Piece } from "@thicctactoe/game";
import { cva } from "class-variance-authority";

import { PieceView } from "./piece";

const cell = cva(
  "grid min-h-24 min-w-24 place-items-center rounded shadow-lg transition-all duration-500 sm:min-h-30 sm:min-w-30",
  {
    variants: {
      isOver: {
        true: "bg-emerald-100",
        false: "bg-white",
      },
      highlighted: {
        true: "ring-4 ring-amber-300",
      },
    },
  },
);

export default function Cell({
  index,
  piece,
  highlighted,
}: {
  index: number;
  piece: Piece | null;
  highlighted: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: index });
  return (
    <div ref={setNodeRef} className={cell({ isOver, highlighted })}>
      {piece && <PieceView player={piece.player} size={piece.size} />}
    </div>
  );
}
