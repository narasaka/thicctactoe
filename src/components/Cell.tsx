import { type UniqueIdentifier, useDroppable } from '@dnd-kit/core';
import cn from 'classnames';

interface CellProps {
  id: UniqueIdentifier;
  children: React.ReactNode;
}

const Cell: React.FC<CellProps> = ({ id, children }) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'grid place-items-center rounded shadow-lg transition-all duration-500',
        {
          'bg-emerald-100': isOver,
          'bg-white': !isOver,
        }
      )}
    >
      {children}
    </div>
  );
};

export default Cell;
