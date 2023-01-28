import type { Move, Player } from '@/models';
import autoAnimate from '@formkit/auto-animate';
import { useEffect, useRef } from 'react';
import Piece from './Piece';
import cn from 'classnames';

interface PieceProps {
  player: Player;
  disabled: boolean;
  moveHistory: Move[];
  isMobile?: boolean;
}

const Pieces: React.FC<PieceProps> = ({
  player,
  disabled,
  moveHistory,
  isMobile,
}) => {
  let pieces;
  if (isMobile) {
    pieces =
      player === 'X'
        ? Array.from({ length: 9 }, (_, i) => i).map(String)
        : Array.from({ length: 9 }, (_, i) => i + 9).map(String);
  } else {
    pieces =
      player === 'X'
        ? Array.from({ length: 9 }, (_, i) => i + 9 * 2).map(String)
        : Array.from({ length: 9 }, (_, i) => i + 9 * 3).map(String);
  }
  const playedPieces = moveHistory.map((move) => move.piece);
  const parent = useRef(null);
  useEffect(() => {
    if (isMobile) return;
    parent.current && autoAnimate(parent.current);
  }, [parent, isMobile]);
  return (
    <div
      className={cn('grid-cols-3 place-items-center gap-4', {
        'hidden md:grid': !isMobile,
        'grid w-full md:hidden': isMobile,
      })}
      ref={parent}
    >
      {pieces
        .slice(0, 3)
        .map((piece) =>
          playedPieces.includes(piece) ? null : (
            <Piece
              key={piece}
              id={piece}
              player={player}
              disabled={disabled}
              size={1}
            />
          )
        )}
      {pieces
        .slice(3, 6)
        .map((piece) =>
          playedPieces.includes(piece) ? null : (
            <Piece
              key={piece}
              id={piece}
              player={player}
              disabled={disabled}
              size={2}
            />
          )
        )}
      {pieces
        .slice(6, 9)
        .map((piece) =>
          playedPieces.includes(piece) ? null : (
            <Piece
              key={piece}
              id={piece}
              player={player}
              disabled={disabled}
              size={3}
            />
          )
        )}
    </div>
  );
};

export default Pieces;
