import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Player, Size } from "@thicctactoe/game";
import { cn } from "@thicctactoe/ui/lib/utils";
import { cva } from "class-variance-authority";
import { Pentagon, Square, Triangle } from "lucide-react";
import type { ComponentProps } from "react";

const piece = cva(
  "flex shrink-0 touch-none items-center justify-center rounded-full font-semibold shadow-lg select-none md:transition-opacity md:duration-500",
  {
    variants: {
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

/**
 * Where a piece is shown decides its size: `tray` for the full trays,
 * `stack` for the phone tray, `cell` to scale with the board cell it is in.
 */
export type PieceFit = "tray" | "stack" | "cell";

const SIZE_CLASS: Record<PieceFit, Record<Size, string>> = {
  tray: {
    small: "size-10 md:m-5 md:size-12",
    medium: "size-16 md:size-18",
    large: "size-20 md:size-24",
  },
  stack: { small: "size-10", medium: "size-13", large: "size-16" },
  cell: { small: "size-[40%]", medium: "size-[62%]", large: "size-[80%]" },
};

const ICON_CLASS: Record<PieceFit, string> = {
  tray: "size-5 md:size-8",
  stack: "size-5",
  // Cells are size containers, so the icon keeps its proportion at any board size.
  cell: "size-[24cqw]",
};

const ICONS = { small: Triangle, medium: Square, large: Pentagon } as const;

type PieceProps = { player: Player; size: Size; fit?: PieceFit };

export function PieceView({
  player,
  size,
  fit = "tray",
  disabled,
  className,
  ...props
}: PieceProps & { disabled?: boolean } & ComponentProps<"div">) {
  const Icon = ICONS[size];
  return (
    <div
      className={cn(
        piece({ player, disabled }),
        SIZE_CLASS[fit][size],
        // Stacked pieces overlap, so their tray dims as a whole instead.
        fit === "stack" && "opacity-100",
        className,
      )}
      {...props}
    >
      <Icon fill="currentColor" strokeWidth={0} className={ICON_CLASS[fit]} />
    </div>
  );
}

const badge = cva("grid size-6 shrink-0 place-items-center rounded-full", {
  variants: {
    player: {
      X: "bg-emerald-400 text-emerald-600",
      O: "bg-indigo-400 text-indigo-600",
    },
  },
});

/** A piece at text size, for move lists. */
export function PieceBadge({
  player,
  size,
  className,
  ...props
}: Omit<PieceProps, "fit"> & ComponentProps<"span">) {
  const Icon = ICONS[size];
  return (
    <span className={cn(badge({ player }), className)} {...props}>
      <Icon fill="currentColor" strokeWidth={0} className="size-[58%]" />
    </span>
  );
}

const SELECTED_RING = {
  X: "ring-4 ring-emerald-600 ring-offset-2 ring-offset-neutral-100",
  O: "ring-4 ring-indigo-600 ring-offset-2 ring-offset-neutral-100",
} as const;

/** A tray piece the player can drag onto the board, or tap to pick up and then tap a cell. */
export function DraggablePiece({
  id,
  disabled,
  selected,
  onSelect,
  className,
  ...pieceProps
}: PieceProps & {
  id: string;
  disabled: boolean;
  selected: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-piece={id}
      // Pieces in a stack overlap: the one in hand goes over its neighbours.
      className={cn(className, (isDragging || selected) && "relative z-10")}
      onClick={onSelect}
      {...listeners}
      {...attributes}
    >
      <PieceView
        {...pieceProps}
        disabled={disabled}
        className={cn(selected && SELECTED_RING[pieceProps.player])}
        style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      />
    </button>
  );
}
