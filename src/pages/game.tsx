import DefaultLayout from '@/layouts/DefaultLayout';
import type { NextPage } from 'next';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import Piece from '@/components/Piece';
import Cell from '@/components/Cell';
import type { GameState, Winner } from '@/models';
import Pieces from '@/components/Pieces';
import { checkWinner } from '@/utils';
import Button from '@/components/Button';
import autoAnimate from '@formkit/auto-animate';

const cellNames = 'ABCDEFGHI';
const initialGameState: GameState = {
  board: cellNames
    .split('')
    .map((name) => ({ player: null, piece: null, id: name })),
  turn: 'X',
  moves: [],
  winner: null,
};

const GamePage: NextPage = () => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const parent = useRef<HTMLDivElement>(null);

  const handleDragEnd = (e: DragEndEvent) => {
    const { over, active } = e;
    if (over) {
      let skip = false;
      setGameState((prev) => {
        const board = prev.board.map((tile) => {
          if (tile.id === over.id) {
            if (tile.piece !== null || tile.player !== null) skip = true;
            if (skip) return tile;
            return { ...tile, player: prev.turn, piece: active.id };
          }
          return tile;
        });
        const moves = skip
          ? prev.moves
          : [
              ...prev.moves,
              { piece: active.id, cell: over.id, player: prev.turn },
            ];
        const turn = skip ? prev.turn : prev.turn === 'X' ? 'O' : 'X';
        const winner = skip ? prev.winner : checkWinner(board);

        return {
          moves,
          board,
          winner,
          turn,
        };
      });
    }
  };

  useEffect(() => {
    parent.current && autoAnimate(parent.current);
  }, [parent]);

  return (
    <>
      <Head>
        <title>ThiccTacToe</title>
        <meta name="description" content="A twist on the classic Tic-Tac-Toe" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <DndContext onDragEnd={handleDragEnd}>
        <DefaultLayout>
          <div className="flex gap-8">
            <Pieces
              key="X"
              player="X"
              disabled={gameState.turn === 'O' || gameState.winner !== null}
              moveHistory={gameState.moves}
            />
            <div className="grid h-96 w-96 grid-cols-3 gap-2">
              {gameState.board.map((tile) => {
                const { id, player, piece } = tile;
                const filled = player !== null && piece;
                return (
                  <Cell key={id} id={id}>
                    {filled ? (
                      <Piece id={piece} player={player} inTile />
                    ) : (
                      <div className="h-20 w-20" />
                    )}
                  </Cell>
                );
              })}
            </div>
            <Pieces
              key="O"
              player="O"
              disabled={gameState.turn === 'X' || gameState.winner !== null}
              moveHistory={gameState.moves}
            />
          </div>
          <div
            className="mt-4 flex flex-col items-center justify-center gap-2"
            ref={parent}
          >
            {gameState.winner && (
              <>
                <div className="mt-4 text-center text-4xl font-extrabold tracking-tight sm:text-5xl">
                  {gameState.winner === 'X' ? 'Green' : 'Purple'} wins!
                </div>
                <Button onClick={() => setGameState(initialGameState)}>
                  Play again
                </Button>
              </>
            )}
            {gameState.board.every((tile) => tile.player !== null) && (
              <>
                <div className="mt-4 text-center text-4xl font-extrabold tracking-tight sm:text-5xl">
                  It&apos;s a tie!
                </div>
                <Button onClick={() => setGameState(initialGameState)}>
                  Play again
                </Button>
              </>
            )}
          </div>
        </DefaultLayout>
      </DndContext>
    </>
  );
};

export default GamePage;
