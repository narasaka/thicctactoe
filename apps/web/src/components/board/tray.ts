import { INVENTORY, type Player, type Size } from "@thicctactoe/game";

/**
 * Pieces in a tray are interchangeable as far as the rules go, but the one
 * the user dragged onto the board should be the one that disappears from the
 * tray. A tray slot is a stable identity for one physical piece.
 */
export type Slot = { player: Player; size: Size; index: number };

export type TrayVariant = "desktop" | "mobile";

export function slotId(variant: TrayVariant, slot: Slot) {
  return [variant, slot.player, slot.size, slot.index].join(":");
}

export function parseSlotId(id: string): Slot {
  const [, player, size, index] = id.split(":");
  return { player: player as Player, size: size as Size, index: Number(index) };
}

/**
 * Slot indexes of `size` still in the tray. `played` lists slots the user
 * dragged onto the board (oldest first); moves not made by dragging here
 * (the opponent's, or before a reload) consume slots from the end.
 */
export function slotsInTray(size: Size, left: number, played: readonly number[]) {
  const total = INVENTORY[size];
  const used = total - left;
  const gone = new Set([...new Set(played)].slice(0, used));
  for (let index = total - 1; index >= 0 && gone.size < used; index--) gone.add(index);
  return Array.from({ length: total }, (_, index) => index).filter((index) => !gone.has(index));
}
