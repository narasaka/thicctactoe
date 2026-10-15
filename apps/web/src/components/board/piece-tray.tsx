import { INVENTORY, type Player, SIZES, type Size } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";

import { DraggablePiece, PieceView } from "./piece";
import { type Slot, type TrayVariant, slotId, slotsInTray } from "./tray";

/** How far each piece in a phone stack overlaps the one before it. */
const STACK_OVERLAP = { small: "-ml-5.5", medium: "-ml-7.5", large: "" } as const;

/**
 * One player's pieces. Every slot keeps its place after its piece is played,
 * so the tray (and everything around it) never changes size.
 *
 * The desktop tray lays every piece out in a grid; the phone tray stacks
 * each size like poker chips to fit in one short row.
 */
export default function PieceTray({
  variant,
  player,
  left,
  played,
  disabled,
  selected,
  onSelect,
}: {
  variant: TrayVariant;
  player: Player;
  left: Record<Size, number>;
  played: readonly Slot[];
  disabled: boolean;
  /** Id of the slot picked up by tapping, if any. */
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const slots = (size: Size) => {
    const playedHere = played
      .filter((slot) => slot.player === player && slot.size === size)
      .map((slot) => slot.index);
    const inTray = new Set(slotsInTray(size, left[size], playedHere));
    const all = Array.from({ length: INVENTORY[size] }, (_, index) => index);
    return { inTray, all };
  };

  if (variant === "mobile") {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center gap-5 transition-opacity duration-500",
          disabled && "opacity-25",
        )}
      >
        {SIZES.map((size) => {
          const { inTray, all } = slots(size);
          // Remaining pieces close ranks; the stack keeps its full width.
          const order = [...all.filter((i) => inTray.has(i)), ...all.filter((i) => !inTray.has(i))];
          return (
            <div key={size} className="flex items-center">
              {order.map((index, position) => {
                const id = slotId(variant, { player, size, index });
                const overlap = position > 0 && STACK_OVERLAP[size];
                return inTray.has(index) ? (
                  <DraggablePiece
                    key={id}
                    id={id}
                    player={player}
                    size={size}
                    fit="stack"
                    disabled={disabled}
                    selected={id === selected}
                    onSelect={() => onSelect(id)}
                    className={overlap || undefined}
                  />
                ) : (
                  <PieceView
                    key={id}
                    player={player}
                    size={size}
                    fit="stack"
                    className={cn("invisible", overlap)}
                    aria-hidden
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 place-items-center gap-4">
      {SIZES.flatMap((size) => {
        const { inTray, all } = slots(size);
        return all.map((index) => {
          const id = slotId(variant, { player, size, index });
          return inTray.has(index) ? (
            <DraggablePiece
              key={id}
              id={id}
              player={player}
              size={size}
              disabled={disabled}
              selected={id === selected}
              onSelect={() => onSelect(id)}
            />
          ) : (
            <PieceView key={id} player={player} size={size} className="invisible" aria-hidden />
          );
        });
      })}
    </div>
  );
}
