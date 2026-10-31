import { cn } from "@thicctactoe/ui/lib/utils";

/** Marks the house bot wherever a player is shown, so it never passes for a person. */
export default function BotTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded bg-sky-100 px-1 text-[0.625rem] leading-4 font-semibold tracking-wide text-sky-700 uppercase",
        className,
      )}
    >
      Bot
    </span>
  );
}
