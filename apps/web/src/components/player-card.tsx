import type { PlayerView } from "@thicctactoe/api/arena";
import type { Player } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";

import Avatar from "./avatar";

const SEAT_COLOR = { X: "bg-emerald-400", O: "bg-indigo-400" } as const;
const SEAT_BADGE = { X: "bg-emerald-500", O: "bg-indigo-500" } as const;

export default function PlayerCard({
  seat,
  player,
  active,
  you,
  delta,
  callout,
}: {
  seat: Player;
  player: PlayerView | null;
  /** Whether it is this player's turn. */
  active: boolean;
  you: boolean;
  delta?: number;
  /** A short message from this player, pinned to the card. */
  callout?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm ring-2 ring-transparent transition",
        active && (seat === "X" ? "ring-emerald-400" : "ring-indigo-400"),
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
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 truncate font-semibold">
          <span className="truncate">{player?.name ?? "Waiting…"}</span>
          {you && <span className="text-xs font-normal text-neutral-400">(you)</span>}
        </div>
        {player && (
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
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
          </div>
        )}
      </div>
    </div>
  );
}
