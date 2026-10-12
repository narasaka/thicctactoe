import { INVENTORY, type Player, SIZES, type Size } from "@thicctactoe/game";
import { cva } from "class-variance-authority";

import { DraggablePiece, PieceView } from "./piece";
import { type Slot, type TrayVariant, slotId, slotsInTray } from "./tray";

const tray = cva("grid-cols-3 place-items-center gap-4", {
  variants: {
    variant: {
      mobile: "grid w-full md:hidden",
      desktop: "hidden md:grid",
    },
  },
});

/**
 * One player's pieces. Every slot keeps its place after its piece is played,
 * so the tray (and everything around it) never changes size.
 */
export default function PieceTray({
  variant,
  player,
  left,
  played,
  disabled,
}: {
  variant: TrayVariant;
  player: Player;
  left: Record<Size, number>;
  played: readonly Slot[];
  disabled: boolean;
}) {
  return (
    <div className={tray({ variant })}>
      {SIZES.flatMap((size) => {
        const playedHere = played
          .filter((slot) => slot.player === player && slot.size === size)
          .map((slot) => slot.index);
        const inTray = new Set(slotsInTray(size, left[size], playedHere));
        return Array.from({ length: INVENTORY[size] }, (_, index) => {
          const id = slotId(variant, { player, size, index });
          return inTray.has(index) ? (
            <DraggablePiece key={id} id={id} player={player} size={size} disabled={disabled} />
          ) : (
            <PieceView key={id} player={player} size={size} className="invisible" aria-hidden />
          );
        });
      })}
    </div>
  );
}
