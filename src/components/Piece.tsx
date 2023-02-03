import type { Size } from '@/models';
import { sizeToText } from '@/utils';
import { type UniqueIdentifier, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cva, VariantProps } from 'class-variance-authority';

const piece = cva(
  'touch-none select-none rounded-full font-semibold shadow-lg md:transition-opacity md:duration-500',
  {
    variants: {
      size: {
        1: 'h-8 w-8 md:m-5 md:h-10 md:w-10',
        2: 'h-12 w-12 md:h-14 md:w-14',
        3: 'h-16 w-16 md:h-20 md:w-20',
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
      {sizeToText(size as Size)}
    </button>
  );
};

export default Piece;
