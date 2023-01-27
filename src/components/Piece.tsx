import type { Player, Size } from '@/models';
import { sizeToText } from '@/utils';
import { type UniqueIdentifier, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
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
    disabled: disabled || inTile,
  });
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;
  const passedListeners = listeners;

  return (
    <button
      ref={setNodeRef}
      {...passedListeners}
      {...attributes}
      className={cn(
        'touch-none rounded-full font-semibold shadow-lg md:transition-opacity md:duration-500',
        {
          'h-8 w-8 md:m-5 md:h-10 md:w-10': size === 1,
          'h-12 w-12 md:h-14 md:w-14': size === 2,
          'h-16 w-16 md:h-20 md:w-20': size === 3,
          'bg-emerald-400 text-emerald-600': player === 'X',
          'bg-indigo-400 text-indigo-600': player === 'O',
          'cursor-not-allowed opacity-25': disabled,
          'cursor-not-allowed': inTile,
        }
      )}
      style={style}
    >
      {sizeToText(size)}
    </button>
  );
};

export default Piece;
