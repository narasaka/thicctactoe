import autoAnimate from "@formkit/auto-animate";
import { type Player, SIZES, type Size } from "@thicctactoe/game";
import { cva } from "class-variance-authority";
import { useEffect, useRef } from "react";

import { DraggablePiece } from "./piece";
import { type Slot, type TrayVariant, slotId, slotsInTray } from "./tray";

const tray = cva("grid-cols-3 place-items-center gap-4", {
  variants: {
    variant: {
      mobile: "grid w-full md:hidden",
      desktop: "hidden md:grid",
    },
  },
});

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
  const parent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (variant === "desktop" && parent.current) autoAnimate(parent.current);
  }, [variant]);

  return (
    <div className={tray({ variant })} ref={parent}>
      {SIZES.flatMap((size) => {
        const playedHere = played
          .filter((slot) => slot.player === player && slot.size === size)
          .map((slot) => slot.index);
        return slotsInTray(size, left[size], playedHere).map((index) => {
          const id = slotId(variant, { player, size, index });
          return (
            <DraggablePiece key={id} id={id} player={player} size={size} disabled={disabled} />
          );
        });
      })}
    </div>
  );
}
