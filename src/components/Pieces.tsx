import type { Move, Player } from '@/models';
import autoAnimate from '@formkit/auto-animate';
import { useEffect, useRef } from 'react';
import Piece from './Piece';
import { cva, VariantProps } from 'class-variance-authority';

const piecesClass = cva('grid-cols-3 place-items-center gap-4', {
  variants: {
    isMobile: {
      true: 'grid w-full md:hidden',
      false: 'hidden md:grid',
    },
  },
  defaultVariants: {
    isMobile: false,
  },
});
type PiecesProps = VariantProps<typeof piecesClass>;

interface Props extends PiecesProps {
  player: Player;
  disabled: boolean;
  moveHistory: Move[];
}

const Pieces: React.FC<Props> = ({
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
    <div className={piecesClass({ isMobile })} ref={parent}>
      {pieces
        .slice(0, 5)
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
        .slice(5, 8)
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
        .slice(8, 9)
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
