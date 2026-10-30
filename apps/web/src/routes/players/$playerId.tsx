import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import type { HistoryEntry, Profile } from "@thicctactoe/api/arena";
import { other } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import Avatar from "@/components/avatar";
import Button, { buttonClass } from "@/components/button";
import Layout from "@/components/layout";
import RatingChart from "@/components/rating-chart";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/players/$playerId")({
  // A failed fetch leaves the name out of the title; the page shows the error.
  loader: async ({ context, params }) => {
    const profile = await context.queryClient
      .ensureQueryData(orpc.players.profile.queryOptions({ input: { id: params.playerId } }))
      .catch(() => null);
    return { name: profile?.name };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? "Player"} | ThiccTacToe` }],
  }),
  component: ProfilePage,
});

const SEAT_COLOR = { X: "bg-emerald-400", O: "bg-indigo-400" } as const;

const RESULT = {
  win: { label: "Win", className: "bg-emerald-100 text-emerald-700" },
  loss: { label: "Loss", className: "bg-rose-100 text-rose-700" },
  draw: { label: "Draw", className: "bg-neutral-100 text-neutral-600" },
} as const;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

function ProfilePage() {
  const { playerId } = Route.useParams();
  const { data: session } = authClient.useSession();
  // Ratings move after every game, so always check for news on a visit.
  const { data: profile, isError } = useQuery({
    ...orpc.players.profile.queryOptions({ input: { id: playerId } }),
    staleTime: 0,
    retry: false,
  });

  if (isError) {
    return (
      <Layout className="container flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-pixel sm:text-5xl">Player not found</h1>
        <Link to="/leaderboard" className={buttonClass()}>
          Leaderboard
        </Link>
      </Layout>
    );
  }
  if (!profile) {
    return (
      <Layout>
        <Loader2 className="animate-spin text-neutral-400" />
      </Layout>
    );
  }

  const you = session?.user.publicId === profile.id;
  const played = profile.wins + profile.losses + profile.draws;

  return (
    <Layout className="container max-w-2xl">
      <Header profile={profile} you={you} />
      <div className="mt-6 grid grid-cols-4 gap-2">
        <Stat label="Rating" value={profile.rating} strong />
        <Stat label="Wins" value={profile.wins} />
        <Stat label="Losses" value={profile.losses} />
        <Stat label="Draws" value={profile.draws} />
      </div>
      <section className="mt-6 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-500">Rating over time</h2>
        {profile.ratings.length > 1 ? (
          // Another player's chart starts fresh rather than inheriting this one's hover.
          <RatingChart
            key={profile.id}
            ratings={profile.ratings}
            played={played}
            className="mt-3"
          />
        ) : (
          <p className="py-8 text-center text-sm text-neutral-500">
            {you ? "Finish a rated game to start your rating trend." : "No rated games yet."}
          </p>
        )}
      </section>
      <section className="mt-6">
        <h2 className="mb-2 px-1 text-sm font-semibold text-neutral-500">Games</h2>
        <Games profile={profile} you={you} />
      </section>
    </Layout>
  );
}

function Header({ profile, you }: { profile: Profile; you: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <Avatar name={profile.name} image={profile.image} className="size-16 text-2xl" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-3xl font-pixel sm:text-4xl">{profile.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
          {you && <Tag>You</Tag>}
          {profile.anonymous && <Tag>Guest</Tag>}
          <span>Joined {monthFormat.format(profile.joinedAt)}</span>
        </div>
      </div>
      {profile.rank !== null && (
        <Link
          to="/leaderboard"
          className="shrink-0 rounded-xl bg-white px-3 py-2 text-center shadow-sm transition hover:bg-neutral-50"
        >
          <div
            className={cn(
              "font-mono text-xl font-semibold",
              profile.rank <= 3 ? "text-amber-500" : "text-neutral-800",
            )}
          >
            #{profile.rank}
          </div>
          <div className="text-xs text-neutral-400">Rank</div>
        </Link>
      )}
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-neutral-200 px-1.5 py-0.5 text-xs font-medium text-neutral-600">
      {children}
    </span>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-white px-3 py-3 text-center shadow-sm">
      <div
        className={cn("font-mono text-xl sm:text-2xl", strong ? "font-bold" : "text-neutral-700")}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-neutral-400 uppercase">{label}</div>
    </div>
  );
}

function Games({ profile, you }: { profile: Profile; you: boolean }) {
  const history = useInfiniteQuery({
    ...orpc.players.history.infiniteOptions({
      input: (after: string | undefined) => ({ id: profile.id, after }),
      initialPageParam: undefined,
      getNextPageParam: (page) => page.next ?? undefined,
    }),
    staleTime: 0,
  });
  const games = history.data?.pages.flatMap((page) => page.games) ?? [];

  return (
    <>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {history.isPending ? (
          <div className="grid place-items-center p-10">
            <Loader2 className="animate-spin text-neutral-400" />
          </div>
        ) : games.length === 0 ? (
          <div className="flex flex-col items-center gap-4 p-10 text-center text-gray-500">
            No finished games yet.
            {you && (
              <Link to="/play" className={buttonClass()}>
                Play online
              </Link>
            )}
          </div>
        ) : (
          <ul>
            {games.map((game) => (
              <GameRow key={game.id} game={game} name={profile.name} you={you} />
            ))}
          </ul>
        )}
      </div>
      {history.hasNextPage && (
        <div className="mt-4 text-center">
          <Button
            intent="secondary"
            disabled={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            {history.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </>
  );
}

/** One game from the profile owner's side. The row opens the replay; the opponent, their profile. */
function GameRow({ game, name, you }: { game: HistoryEntry; name: string; you: boolean }) {
  const result = RESULT[game.result];
  const { opponent, ratingDelta: delta } = game;
  const resigned =
    game.endReason !== "resign"
      ? null
      : game.result === "win"
        ? you
          ? "they resigned"
          : `${opponent?.name ?? "opponent"} resigned`
        : you
          ? "you resigned"
          : `${name} resigned`;

  return (
    <li className="relative flex items-center gap-3 border-t border-neutral-100 px-4 py-3 transition first:border-t-0 hover:bg-neutral-50">
      <Link
        to="/history/$gameId"
        params={{ gameId: game.id }}
        aria-label={`Replay ${result.label.toLowerCase()} against ${opponent?.name ?? "a deleted player"}`}
        className="absolute inset-0"
      />
      <span
        className={cn("w-12 rounded-md py-1 text-center text-xs font-semibold", result.className)}
      >
        {result.label}
      </span>
      {/* Positioned for the seat dot, which would otherwise lift it over the replay link. */}
      <div className="pointer-events-none relative">
        <Avatar name={opponent?.name ?? "?"} image={opponent?.image} />
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white",
            SEAT_COLOR[other(game.seat)],
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          <span className="font-normal text-neutral-400">vs </span>
          {opponent ? (
            <Link
              to="/players/$playerId"
              params={{ playerId: opponent.id }}
              className="relative hover:underline"
            >
              {opponent.name}
            </Link>
          ) : (
            "Deleted player"
          )}
        </div>
        <div className="truncate text-xs text-neutral-500">
          {game.moveCount} {game.moveCount === 1 ? "move" : "moves"}
          {resigned && ` · ${resigned}`}
          {game.private && " · friend game"}
          {delta === null && " · unrated"} · {dateFormat.format(game.finishedAt)}
        </div>
      </div>
      {delta !== null && (
        <span
          className={cn(
            "font-mono text-sm font-semibold",
            delta >= 0 ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {delta >= 0 ? `+${delta}` : delta}
        </span>
      )}
    </li>
  );
}
