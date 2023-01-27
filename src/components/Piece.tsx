import type { Player, Size } from '@/models';
import { getStyleFromSize, sizeToText } from '@/utils';
import { type UniqueIdentifier, useDraggable } from '@dnd-kit/core';

interface PieceProps {
  id: UniqueIdentifier;
  player: Player;
  disabled?: boolean;
  size?: Size;
  inTile?: boolean;
}

const Piece: React.FC<PieceProps> = ({
  id,
  player,
  disabled,
  inTile,
  size,
}) => {
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
      className={`rounded-full shadow-lg transition-opacity duration-500 ${getStyleFromSize(
        size
      )} ${
        player === 'X'
          ? 'bg-emerald-400 text-emerald-600'
          : 'bg-indigo-400 text-indigo-600'
      } ${disabled ? 'cursor-not-allowed opacity-25' : ''} ${
        inTile ? 'cursor-not-allowed' : ''
      }`}
      style={style}
    >
      {sizeToText(size)}
    </button>
  );
};

export default Piece;
