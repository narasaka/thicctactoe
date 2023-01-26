import type { Player } from '@/models';
import { type UniqueIdentifier, useDraggable } from '@dnd-kit/core';

interface PieceProps {
  id: UniqueIdentifier;
  player: Player;
  disabled?: boolean;
  size?: number;
  inTile?: boolean;
}

const Piece: React.FC<PieceProps> = ({ id, player, disabled, inTile }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;
  const passedListeners = disabled || inTile ? {} : listeners;
  return (
    <button
      ref={setNodeRef}
      {...passedListeners}
      {...attributes}
      className={`m-3 h-14 w-14 rounded-full shadow-lg transition-all duration-500 ${
        player === 'X' ? 'bg-emerald-400' : 'bg-indigo-400'
      } ${disabled ? 'cursor-not-allowed opacity-25' : ''} ${
        inTile ? 'cursor-not-allowed' : ''
      }`}
      style={style}
    />
  );
};

export default Piece;
