import DefaultLayout from '@/layouts/DefaultLayout';
import type { NextPage } from 'next';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import Piece from '@/components/Piece';
import Cell from '@/components/Cell';
import { GameState, Winner } from '@/models';
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
  winner: null,
  moves: [],
};

const GamePage: NextPage = () => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const parent = useRef<HTMLDivElement>(null);

  const handleDragEnd = (e: DragEndEvent) => {
    const { over, active } = e;
    if (over) {
      setGameState((prev) => {
        const board = prev.board.map((tile) =>
          tile.id === over.id
            ? {
                ...tile,
                player: prev.turn,
                piece: active.id,
              }
            : tile
        );
        const winner = checkWinner(Object.values(board)) as Winner;
        const move = {
          piece: active.id,
          cell: over.id,
          player: prev.turn,
        };
        return {
          moves: [...prev.moves, move],
          board,
          winner,
          turn: prev.turn === 'X' ? 'O' : 'X',
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
              player="X"
              disabled={gameState.turn === 'O' || gameState.winner !== null}
              gameState={gameState}
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
              player="O"
              disabled={gameState.turn === 'X' || gameState.winner !== null}
              gameState={gameState}
            />
          </div>
          <div
            className="flex flex-col items-center justify-center gap-2"
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
          </div>
        </DefaultLayout>
      </DndContext>
    </>
  );
};

export default GamePage;
