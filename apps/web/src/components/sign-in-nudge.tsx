import type { PlayerView } from "@thicctactoe/api/arena";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@thicctactoe/ui/components/dialog";

import { PROVIDERS, signInWith } from "@/lib/auth-client";

import Avatar from "./avatar";
import Button from "./button";

const TITLE = {
  win: "Put that win on the board",
  loss: "Climb the leaderboard",
  tie: "Climb the leaderboard",
} as const;

/**
 * Asks a guest to sign in after an online game, so the game and their rating
 * carry over to an account that shows up on the leaderboard.
 */
export default function SignInNudge({
  open,
  onOpenChange,
  player,
  result,
  delta,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: PlayerView;
  result: keyof typeof TITLE;
  delta?: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 rounded-2xl bg-white p-6 text-center text-base shadow-xl ring-0 sm:max-w-sm"
      >
        <div className="mx-auto flex items-center gap-3 rounded-xl bg-neutral-100 px-3 py-2">
          <Avatar name={player.name} image={player.image} className="size-10" />
          <div className="min-w-0 text-left">
            <div className="truncate font-semibold">{player.name}</div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span>{player.rating}</span>
              {delta !== undefined && (
                <span className={delta >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {delta >= 0 ? `+${delta}` : delta}
                </span>
              )}
              <span className="text-neutral-400">· guest</span>
            </div>
          </div>
        </div>
        <DialogTitle className="mt-5 text-2xl font-extrabold tracking-tight">
          {TITLE[result]}
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-gray-500">
          Guests don&apos;t show up on the leaderboard. Sign in to keep this game and your rating,
          and get ranked.
        </DialogDescription>
        <div className="mt-6 flex flex-col gap-2">
          {PROVIDERS.map(({ id, name }, index) => (
            <Button
              key={id}
              intent={index === 0 ? "primary" : "secondary"}
              onClick={() => signInWith(id)}
            >
              Continue with {name}
            </Button>
          ))}
        </div>
        <DialogClose className="mt-4 text-sm text-neutral-400 underline hover:text-neutral-600">
          Not now
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
