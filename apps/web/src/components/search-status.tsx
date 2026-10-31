import { cn } from "@thicctactoe/ui/lib/utils";
import { Loader2 } from "lucide-react";

import type { MatchView } from "@/lib/match-view";

/** While a player plays the bot: whether the match they are waiting for has been found. */
export default function SearchStatus({
  search,
  className,
}: {
  search: NonNullable<MatchView["search"]>;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-xs whitespace-nowrap",
        search.found ? "font-semibold text-emerald-600" : "text-neutral-500",
        className,
      )}
    >
      <Loader2 className="size-3.5 animate-spin" />
      {search.found ? "Player found! Switching…" : "Still searching…"}
    </span>
  );
}
