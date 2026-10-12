import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Player, Size } from "@thicctactoe/game";
import { cva } from "class-variance-authority";
import { Pentagon, Square, Triangle } from "lucide-react";
import type { ComponentProps } from "react";

const piece = cva(
  "flex touch-none items-center justify-center rounded-full font-semibold shadow-lg select-none md:transition-opacity md:duration-500",
  {
    variants: {
      size: {
        small: "h-10 w-10 md:m-5 md:h-12 md:w-12",
        medium: "h-16 w-16 md:h-18 md:w-18",
        large: "h-20 w-20 md:h-24 md:w-24",
      },
      player: {
        X: "bg-emerald-400 text-emerald-600",
        O: "bg-indigo-400 text-indigo-600",
      },
      disabled: {
        true: "cursor-not-allowed opacity-25",
        false: "cursor-grab",
      },
    },
  },
);

const ICON_PROPS = {
  fill: "currentColor",
  strokeWidth: 0,
  className: "h-5 w-5 md:h-8 md:w-8",
} as const;

const ICONS = { small: Triangle, medium: Square, large: Pentagon } as const;

type PieceProps = { player: Player; size: Size };

export function PieceView({
  player,
  size,
  disabled,
  className,
  ...props
}: PieceProps & { disabled?: boolean } & ComponentProps<"div">) {
  const Icon = ICONS[size];
  return (
    <div className={piece({ player, size, disabled, className })} {...props}>
      <Icon {...ICON_PROPS} />
    </div>
  );
}

export function DraggablePiece({
  id,
  disabled,
  ...pieceProps
}: PieceProps & { id: string; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id, disabled });
  return (
    <button ref={setNodeRef} type="button" data-slot={id} {...listeners} {...attributes}>
      <PieceView
        {...pieceProps}
        disabled={disabled}
        style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      />
    </button>
  );
}
