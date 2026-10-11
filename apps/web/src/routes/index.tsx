import { Link, createFileRoute } from "@tanstack/react-router";

import { buttonClass } from "@/components/button";
import Layout from "@/components/layout";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <Layout className="container">
      <h1 className="text-center text-6xl font-extrabold tracking-tight sm:text-7xl">
        ThiccTacToe
      </h1>
      <h2 className="text-center text-gray-500 sm:text-lg">a twist on the classic TicTacToe</h2>
      <div className="p-2" />
      <div className="flex flex-col gap-2 px-8 md:flex-row md:justify-center">
        <Link to="/game" className={buttonClass({ className: "text-center" })}>
          Play local
        </Link>
        <Link to="/play" className={buttonClass({ intent: "secondary", className: "text-center" })}>
          Play online
        </Link>
      </div>
      <div className="mt-2 text-center">
        <Link to="/tutorial" className="text-sm text-neutral-500 underline hover:text-neutral-700">
          How to play
        </Link>
        <span className="mx-2 text-neutral-300">·</span>
        <Link
          to="/leaderboard"
          className="text-sm text-neutral-500 underline hover:text-neutral-700"
        >
          Leaderboard
        </Link>
      </div>
    </Layout>
  );
}
