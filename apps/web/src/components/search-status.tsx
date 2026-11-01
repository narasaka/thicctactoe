import { Link } from "@tanstack/react-router";
import { cn } from "@thicctactoe/ui/lib/utils";
import { ArrowRight, Loader2 } from "lucide-react";

import type { MatchView } from "@/lib/match-view";

/** While a player plays the bot: still searching, or a way into the match someone joined. */
export default function SearchStatus({
  search,
  className,
}: {
  search: NonNullable<MatchView["search"]>;
  className?: string;
}) {
  const style = cn("flex items-center gap-1.5 text-xs whitespace-nowrap", className);
  if (search.found) {
    return (
      <Link
        to="/play/$gameId"
        params={{ gameId: search.id }}
        className={cn(style, "font-semibold text-emerald-600 hover:underline")}
      >
        Player found! Join match
        <ArrowRight className="size-3.5" />
      </Link>
    );
  }
  return (
    <span className={cn(style, "text-neutral-500")}>
      <Loader2 className="size-3.5 animate-spin" />
      Still searching…
    </span>
  );
}
