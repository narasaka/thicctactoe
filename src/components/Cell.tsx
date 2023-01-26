import { type UniqueIdentifier, useDroppable } from '@dnd-kit/core';

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
      className={`grid place-items-center rounded shadow-lg transition-all duration-500 ${
        isOver ? 'bg-emerald-100' : 'bg-white'
      }`}
    >
      {children}
    </div>
  );
};

export default Cell;
