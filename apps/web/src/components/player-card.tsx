import type { PlayerView } from "@thicctactoe/api/arena";
import { type Game, INVENTORY, type Player, SIZES, type Size, piecesLeft } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";
import { Hourglass } from "lucide-react";

import Avatar from "./avatar";
import { PieceBadge } from "./board/piece";

const SEAT_COLOR = { X: "bg-emerald-400", O: "bg-indigo-400" } as const;
const SEAT_BADGE = { X: "bg-emerald-500", O: "bg-indigo-500" } as const;

/** How many pieces of each size `player` has put on the board. */
export function piecesUsed(game: Game, player: Player): Record<Size, number> {
  const left = piecesLeft(game, player);
  return {
    small: INVENTORY.small - left.small,
    medium: INVENTORY.medium - left.medium,
    large: INVENTORY.large - left.large,
  };
}

export default function PlayerCard({
  seat,
  player,
  active,
  you,
  used,
  delta,
  callout,
  className,
}: {
  seat: Player;
  player: PlayerView | null;
  /** Whether it is this player's turn. */
  active: boolean;
  you: boolean;
  /** Pieces this player has played, shown under their name like captures in chess. */
  used: Record<Size, number>;
  delta?: number;
  /** A short message from this player, pinned to the card. */
  callout?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm ring-2 ring-transparent transition",
        active && (seat === "X" ? "ring-emerald-400" : "ring-indigo-400"),
        className,
      )}
    >
      {callout && (
        <span
          className={cn(
            "absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-xs font-semibold text-white shadow-sm animate-in fade-in zoom-in-75",
            SEAT_BADGE[seat],
          )}
        >
          {callout}
        </span>
      )}
      <div className="relative">
        <Avatar name={player?.name ?? "?"} image={player?.image} className="size-10" />
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-white",
            SEAT_COLOR[seat],
          )}
        />
        {active && (
          <span
            className={cn(
              "absolute -top-1.5 -left-1.5 grid size-5.5 place-items-center rounded-full border-2 border-white text-white animate-in fade-in zoom-in-50",
              SEAT_BADGE[seat],
            )}
            title={you ? "Your turn" : `Waiting for ${player?.name ?? "opponent"}`}
          >
            <Hourglass className="size-3 animate-hourglass" strokeWidth={2.75} />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{player?.name ?? "Waiting…"}</span>
          {you && <span className="text-xs text-neutral-400">(you)</span>}
          {player && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-500">
              <span>{player.rating}</span>
              {delta !== undefined && (
                <span className={delta >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {delta >= 0 ? `+${delta}` : delta}
                </span>
              )}
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  player.online ? "bg-emerald-500" : "bg-neutral-300",
                )}
                title={player.online ? "Online" : "Offline"}
              />
            </span>
          )}
        </div>
        <div className="mt-0.5 flex h-5 items-center gap-1.5" aria-label="Pieces played">
          {SIZES.map(
            (size) =>
              used[size] > 0 && (
                <span key={size} className="flex">
                  {Array.from({ length: used[size] }, (_, index) => (
                    <PieceBadge
                      key={index}
                      player={seat}
                      size={size}
                      className="size-5 ring-2 ring-white not-first:-ml-1.5"
                    />
                  ))}
                </span>
              ),
          )}
        </div>
      </div>
    </div>
  );
}
