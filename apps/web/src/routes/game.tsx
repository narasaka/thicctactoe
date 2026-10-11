import { createFileRoute } from "@tanstack/react-router";
import { type Game, PLAYERS, newGame, play } from "@thicctactoe/game";
import { useState } from "react";

import GameBoard from "@/components/board/game-board";
import Button from "@/components/button";
import Layout from "@/components/layout";

export const Route = createFileRoute("/game")({
  component: LocalGamePage,
});

const PLAYER_NAMES = { X: "Green", O: "Purple" } as const;

function LocalGamePage() {
  const [game, setGame] = useState<Game>(newGame);
  const [round, setRound] = useState(0);
  const { outcome } = game;

  const restart = () => {
    setGame(newGame());
    setRound((n) => n + 1);
  };

  return (
    <Layout>
      <GameBoard
        key={round}
        game={game}
        seats={PLAYERS}
        onMove={(move) => {
          const result = play(game, move);
          if (result.ok) setGame(result.game);
        }}
        status={
          outcome.status === "playing" ? (
            <div className="text-gray-500">{PLAYER_NAMES[game.turn]}&apos;s turn</div>
          ) : (
            <>
              <div className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
                {outcome.status === "won" ? `${PLAYER_NAMES[outcome.winner]} wins` : "It's a tie!"}
              </div>
              <Button onClick={restart}>Play again</Button>
            </>
          )
        }
      />
    </Layout>
  );
}
