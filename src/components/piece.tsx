import { type UniqueIdentifier, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cva, type VariantProps } from 'class-variance-authority';
import { Triangle, Square, Pentagon } from 'lucide-react';

const piece = cva(
  'flex items-center justify-center touch-none select-none rounded-full font-semibold shadow-lg md:transition-opacity md:duration-500',
  {
    variants: {
      size: {
        small: 'h-10 w-10 md:m-5 md:h-12 md:w-12',
        medium: 'h-16 w-16 md:h-18 md:w-18',
        large: 'h-20 w-20 md:h-24 md:w-24',
      },
      player: {
        X: 'bg-emerald-400 text-emerald-600',
        O: 'bg-indigo-400 text-indigo-600',
      },
      disabled: {
        true: 'cursor-not-allowed opacity-25',
      },
      inTile: {
        true: 'cursor-not-allowed',
      },
    },
  }
);
type PieceProps = VariantProps<typeof piece>;

interface Props extends PieceProps {
  id: UniqueIdentifier;
  inTile?: boolean;
  disabled?: boolean;
}

const ICON_PROPS = {
  fill: 'currentColor',
  strokeWidth: 0,
  className: 'h-5 w-5 md:h-8 md:w-8',
} as const;

const Piece: React.FC<Props> = ({ id, player, disabled, inTile, size }) => {
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
      className={piece({ player, size, disabled, inTile })}
      style={style}
    >
      {size === 'small' && <Triangle {...ICON_PROPS} />}
      {size === 'medium' && <Square {...ICON_PROPS} />}
      {size === 'large' && <Pentagon {...ICON_PROPS} />}
    </button>
  );
};

export default Piece;
