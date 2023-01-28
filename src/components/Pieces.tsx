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
  const pieces =
    player === 'X'
      ? [0, 1, 2, 3, 4, 5, 6, 7, 8].map(String)
      : [9, 11, 12, 13, 14, 15, 16, 17, 18].map(String);
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
              id={isMobile ? piece : parseInt(piece) * 3}
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
              id={isMobile ? piece : parseInt(piece) * 3}
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
              id={isMobile ? piece : parseInt(piece) * 3}
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
