import { type Move, positions } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";
import { useEffect, useState } from "react";

import { PieceView } from "./board/piece";

/** A short game that shows the twist: green's large piece gobbles purple's, then wins. */
const MOVES: Move[] = [
  { player: "X", size: "small", cell: 0 },
  { player: "O", size: "medium", cell: 4 },
  { player: "X", size: "large", cell: 4 },
  { player: "O", size: "small", cell: 2 },
  { player: "X", size: "small", cell: 8 },
];

const GAMES = positions(MOVES);
const LAST = GAMES.length - 1;
const MOVE_MS = 900;
const HOLD_MS = 2400;

/** A small board that plays itself on a loop, like a game's attract mode. */
export default function DemoBoard({ className }: { className?: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(LAST);
      return;
    }
    const timer = setTimeout(
      () => setStep((current) => (current === LAST ? 0 : current + 1)),
      step === LAST ? HOLD_MS : MOVE_MS,
    );
    return () => clearTimeout(timer);
  }, [step]);

  const game = GAMES[step]!;
  const line: readonly number[] = game.outcome.status === "won" ? game.outcome.line : [];
  return (
    <div aria-hidden className={cn("grid grid-cols-3 gap-1.5", className)}>
      {game.board.map((piece, cell) => (
        <div
          key={cell}
          className={cn(
            "@container grid size-14 place-items-center rounded bg-white shadow-md transition-shadow duration-500 sm:size-16",
            line.includes(cell) && "ring-3 ring-amber-300",
          )}
        >
          {piece && (
            <PieceView
              // A new key per piece replays the drop-in when a bigger piece gobbles.
              key={`${piece.player}-${piece.size}`}
              player={piece.player}
              size={piece.size}
              fit="cell"
              className="cursor-auto shadow-md duration-300 animate-in fade-in zoom-in-150"
            />
          )}
        </div>
      ))}
    </div>
  );
}
