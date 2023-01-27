import type { Player, Size } from '@/models';
import { sizeToText } from '@/utils';
import { type UniqueIdentifier, useDraggable } from '@dnd-kit/core';
import cn from 'classnames';

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
      className={cn('rounded-full shadow-lg transition-opacity duration-500', {
        'm-5 h-10 w-10': size === 1,
        'm-3 h-14 w-14': size === 2,
        'h-20 w-20': size === 3,
        'bg-emerald-400 text-emerald-600': player === 'X',
        'bg-indigo-400 text-indigo-600': player === 'O',
        'cursor-not-allowed opacity-25': disabled,
        'cursor-not-allowed': inTile,
      })}
      style={style}
    >
      {sizeToText(size)}
    </button>
  );
};

export default Piece;
