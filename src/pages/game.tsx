import DefaultLayout from '@/layouts/DefaultLayout';
import type { NextPage } from 'next';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import Head from 'next/head';
import { useEffect, useRef, useState } from 'react';
import Piece from '@/components/Piece';
import Cell from '@/components/Cell';
import { type GameState, type Size, tileSchema } from '@/models';
import Pieces from '@/components/Pieces';
import { checkWinner, idToSize, numerizedSize } from '@/utils';
import Button from '@/components/Button';
import autoAnimate from '@formkit/auto-animate';
import cn from 'classnames';

const cellNames = 'ABCDEFGHI';
const initialGameState: GameState = {
  board: cellNames
    .split('')
    .map((name) => ({ player: null, piece: null, id: name, size: null })),
  turn: 'X',
  moves: [],
  winner: null,
};

const GamePage: NextPage = () => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const winnerContainer = useRef<HTMLDivElement>(null);
  const mobilePieceContainer = useRef<HTMLDivElement>(null);
  const isTie = gameState.board.every((tile) => tile.player !== null);

  const handleDragEnd = (e: DragEndEvent) => {
    const over = e.over as { id: string };
    const active = e.active as { id: string };
    if (over) {
      let skip = false;
      setGameState((prev) => {
        const board = prev.board.map((tile) => {
          if (tile.id === over.id) {
            const currPieceSize = idToSize(active.id);
            if (
              tile.size &&
              numerizedSize(tile.size) >= numerizedSize(currPieceSize) &&
              tile.piece !== null &&
              tile.player !== null
            )
              skip = true;
            if (skip) return tile;
            return {
              ...tile,
              player: prev.turn,
              piece: active.id,
              size: currPieceSize as Size,
            };
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
          ...prev,
          moves,
          board,
          winner,
          turn,
        };
      });
    }
  };

  useEffect(() => {
    winnerContainer.current && autoAnimate(winnerContainer.current);
  }, [winnerContainer]);

  useEffect(() => {
    mobilePieceContainer.current && autoAnimate(mobilePieceContainer.current);
  }, [mobilePieceContainer]);

  return (
    <>
      <Head>
        <title>ThiccTacToe</title>
        <meta name="description" content="A twist on the classic tictactoe" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <DndContext onDragEnd={handleDragEnd}>
        <DefaultLayout>
          <div className="grid place-items-center gap-8 lg:grid-cols-3">
            <Pieces
              key="X"
              player="X"
              disabled={gameState.turn === 'O' || gameState.winner !== null}
              moveHistory={gameState.moves}
            />
            <div className="grid grid-cols-3 gap-2">
              {gameState.board.map((tile) => {
                const { id, player, piece, size } = tileSchema.parse(tile);
                const filled = player !== null && piece;
                return (
                  <Cell key={id} id={id}>
                    {filled && (
                      <Piece id={piece} player={player} inTile size={size} />
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
            className={cn(
              'mt-4 flex flex-col items-center justify-center gap-2'
            )}
            ref={winnerContainer}
          >
            {gameState.winner && (
              <>
                <div className="mt-4 text-center text-4xl font-extrabold tracking-tight sm:text-5xl">
                  {gameState.winner === 'X' ? 'Green wins' : 'Purple wins'}
                </div>
                <Button onClick={() => setGameState(initialGameState)}>
                  Play again
                </Button>
              </>
            )}
            {!gameState.winner && isTie && (
              <>
                <div className="mt-4 text-center text-4xl font-extrabold tracking-tight sm:text-5xl">
                  It&apos;s a tie!
                </div>
                <Button onClick={() => setGameState(initialGameState)}>
                  Play again
                </Button>
              </>
            )}
            {!gameState.winner && !isTie && (
              <>
                <div
                  className={cn('transition-all duration-300', {
                    'fixed translate-y-full opacity-0': gameState.turn === 'O',
                  })}
                >
                  <Pieces
                    key="X"
                    player="X"
                    disabled={gameState.winner !== null}
                    moveHistory={gameState.moves}
                    isMobile
                  />
                </div>
                <div
                  className={cn('transition-all duration-300', {
                    'fixed translate-y-full opacity-0': gameState.turn === 'X',
                  })}
                >
                  <Pieces
                    key="O"
                    player="O"
                    disabled={gameState.winner !== null}
                    moveHistory={gameState.moves}
                    isMobile
                  />
                </div>
              </>
            )}
          </div>
        </DefaultLayout>
      </DndContext>
    </>
  );
};

export default GamePage;
