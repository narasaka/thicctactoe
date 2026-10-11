import type { PlayerView } from "@thicctactoe/api/arena";
import type { Player } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";

import Avatar from "./avatar";

const SEAT_COLOR = { X: "bg-emerald-400", O: "bg-indigo-400" } as const;

export default function PlayerCard({
  seat,
  player,
  active,
  you,
  delta,
}: {
  seat: Player;
  player: PlayerView | null;
  /** Whether it is this player's turn. */
  active: boolean;
  you: boolean;
  delta?: number;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm ring-2 ring-transparent transition",
        active && (seat === "X" ? "ring-emerald-400" : "ring-indigo-400"),
      )}
    >
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
