import type { GameState, Player } from '@/models';
import autoAnimate from '@formkit/auto-animate';
import { useEffect, useRef } from 'react';
import Piece from './Piece';

interface PieceProps {
  player: Player;
  disabled: boolean;
  gameState: GameState;
}

const Pieces: React.FC<PieceProps> = ({ player, disabled, gameState }) => {
  const pieces =
    player === 'X'
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9].map(String)
      : [10, 11, 12, 13, 14, 15, 16, 17, 18].map(String);
  const playedPieces = gameState.moves.map((move) => move.piece);
  const parent = useRef(null);
  useEffect(() => {
    parent.current && autoAnimate(parent.current);
  }, [parent]);
  return (
    <div className="grid grid-cols-3 gap-4" ref={parent}>
      {pieces.map((piece) =>
        playedPieces.includes(piece) ? null : (
          <Piece key={piece} id={piece} player={player} disabled={disabled} />
        )
      )}
    </div>
  );
};

export default Pieces;
