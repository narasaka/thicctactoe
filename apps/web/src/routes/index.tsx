import { Link, createFileRoute } from "@tanstack/react-router";
import { cn } from "@thicctactoe/ui/lib/utils";
import { BookOpen, History, Trophy } from "lucide-react";

import { buttonClass } from "@/components/button";
import DemoBoard from "@/components/demo-board";
import Layout from "@/components/layout";

export const Route = createFileRoute("/")({
  component: HomePage,
});

// Arcade buttons: a hard bottom edge that the button sinks into when pressed.
const arcade = "py-3 text-center text-lg active:translate-y-1";

const tile =
  "flex flex-col items-center gap-1 rounded-lg bg-white py-2.5 text-xs text-neutral-600 shadow-sm transition hover:bg-neutral-50 hover:text-neutral-900";

function HomePage() {
  return (
    <Layout className="relative flex w-full flex-col items-center">
      {/* A faint dot grid behind the menu, fading out toward the edges. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(var(--color-neutral-300)_1px,transparent_1px)] bg-size-[22px_22px] mask-radial-from-20% mask-radial-to-70%"
      />
      <DemoBoard className="relative" />
      <h1 className="relative mt-8 text-center font-pixel text-6xl sm:text-7xl">ThiccTacToe</h1>
      <p className="relative mt-2 text-center text-gray-500 sm:text-lg">
        a twist on the classic TicTacToe
      </p>
      <nav className="relative mt-8 flex w-full max-w-xs flex-col gap-3">
        <Link
          to="/play"
          className={buttonClass({
            className: cn(arcade, "shadow-[0_4px_0_var(--color-neutral-950)] active:shadow-none"),
          })}
        >
          Play online
        </Link>
        <Link
          to="/game"
          className={buttonClass({
            intent: "secondary",
            className: cn(arcade, "shadow-[0_4px_0_var(--color-neutral-400)] active:shadow-none"),
          })}
        >
          Play local
        </Link>
      </nav>
      <div className="relative mt-4 grid w-full max-w-xs grid-cols-3 gap-2">
        <Link to="/tutorial" className={tile}>
          <BookOpen className="size-5" />
          How to play
        </Link>
        <Link to="/leaderboard" className={tile}>
          <Trophy className="size-5" />
          Leaderboard
        </Link>
        <Link to="/history" className={tile}>
          <History className="size-5" />
          Your games
        </Link>
      </div>
    </Layout>
  );
}
