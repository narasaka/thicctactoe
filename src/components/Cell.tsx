import { type UniqueIdentifier, useDroppable } from '@dnd-kit/core';
import { cva, VariantProps } from 'class-variance-authority';

const cell = cva(
  'grid min-w-[5rem] min-h-[5rem] sm:min-w-[6rem] sm:min-h-[6rem] place-items-center rounded shadow-lg transition-all duration-500',
  {
    variants: {
      isOver: {
        true: 'bg-emerald-100',
        false: 'bg-white',
      },
    },
    defaultVariants: {
      isOver: false,
    },
  }
);
type CellProps = VariantProps<typeof cell>;

interface Props extends CellProps {
  id: UniqueIdentifier;
  children: React.ReactNode;
}

const Cell: React.FC<Props> = ({ id, children }) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });
  return (
    <div ref={setNodeRef} className={cell({ isOver })}>
      {children}
    </div>
  );
};

export default Cell;
