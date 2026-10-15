import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import type { DragEndEvent, UniqueIdentifier } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cva } from "class-variance-authority";
import { ChevronLeft, ChevronRight, Check, Triangle, Square, Pentagon } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useCallback, useState } from "react";

export const Route = createFileRoute("/tutorial")({
  head: () => ({
    meta: [
      { title: "Tutorial | ThiccTacToe" },
      { name: "description", content: "Learn how to play ThiccTacToe in 5 easy steps" },
    ],
  }),
  component: TutorialPage,
});

type PieceSize = "small" | "medium" | "large";
type Player = "X" | "O";

const pieceVariants = cva(
  "flex shrink-0 items-center justify-center touch-none select-none rounded-full font-semibold shadow-lg",
  {
    variants: {
      size: {
        small: "h-10 w-10 md:h-12 md:w-12",
        medium: "h-16 w-16 md:h-18 md:w-18",
        large: "h-20 w-20 md:h-24 md:w-24",
      },
      player: {
        X: "bg-emerald-400 text-emerald-600",
        O: "bg-indigo-400 text-indigo-600",
      },
    },
  },
);

const cellVariants = cva(
  "grid size-24 place-items-center rounded shadow-lg transition-all duration-500 sm:size-30",
  {
    variants: {
      isOver: {
        true: "bg-emerald-100",
        false: "bg-white",
      },
    },
    defaultVariants: {
      isOver: false,
    },
  },
);

const buttonVariants = cva("rounded-lg px-4 py-2 font-pixel transition-all duration-200", {
  variants: {
    intent: {
      primary: "bg-neutral-800 text-white hover:bg-neutral-700 active:bg-neutral-600",
      secondary:
        "border border-gray-300 bg-neutral-200 text-black hover:bg-neutral-300 active:bg-neutral-400",
    },
    disabled: {
      true: "cursor-not-allowed opacity-50",
    },
  },
  defaultVariants: {
    intent: "primary",
  },
});

const ICON_PROPS = {
  fill: "currentColor",
  strokeWidth: 0,
  className: "h-5 w-5 md:h-8 md:w-8",
} as const;

function PieceIcon({ size }: { size: PieceSize }) {
  if (size === "small") return <Triangle {...ICON_PROPS} />;
  if (size === "medium") return <Square {...ICON_PROPS} />;
  return <Pentagon {...ICON_PROPS} />;
}

interface TutorialPieceProps {
  id: UniqueIdentifier;
  size: PieceSize;
  player: Player;
  disabled?: boolean;
}

function TutorialPiece({ id, size, player, disabled }: TutorialPieceProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    disabled: !!disabled,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={pieceVariants({ size, player })}
      style={style}
    >
      <PieceIcon size={size} />
    </button>
  );
}

function StaticPiece({ size, player }: { size: PieceSize; player: Player }) {
  return (
    <div className={pieceVariants({ size, player })}>
      <PieceIcon size={size} />
    </div>
  );
}

interface TutorialCellProps {
  id: UniqueIdentifier;
  children: ReactNode;
  highlight?: boolean;
  disabled?: boolean;
}

function TutorialCell({ id, children, highlight, disabled }: TutorialCellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled: !!disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${cellVariants({ isOver: isOver || undefined })} ${
        highlight ? "ring-2 ring-emerald-400 ring-offset-2 animate-pulse" : ""
      }`}
    >
      {children}
    </div>
  );
}

function Step1Content() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-3xl font-pixel sm:text-4xl">Your Pieces</h2>
      <p className="min-h-18 max-w-sm text-center text-neutral-600">
        You have <span className="font-bold">3 sizes</span> of pieces. More sides means bigger:
        triangle (3) &lt; square (4) &lt; pentagon (5).
      </p>

      <div className="flex items-end gap-6">
        <div className="flex flex-col items-center gap-2">
          <StaticPiece size="small" player="X" />
          <span className="text-xs font-medium text-neutral-500">Small &times;5</span>
          <Triangle fill="currentColor" strokeWidth={0} className="h-4 w-4 text-neutral-400" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <StaticPiece size="medium" player="X" />
          <span className="text-xs font-medium text-neutral-500">Medium &times;3</span>
          <Square fill="currentColor" strokeWidth={0} className="h-4 w-4 text-neutral-400" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <StaticPiece size="large" player="X" />
          <span className="text-xs font-medium text-neutral-500">Large &times;1</span>
          <Pentagon fill="currentColor" strokeWidth={0} className="h-4 w-4 text-neutral-400" />
        </div>
      </div>

      <p className="max-w-xs text-center text-sm text-neutral-500">
        More sides = bigger piece. Use them wisely!
      </p>
    </div>
  );
}

interface InteractiveStepProps {
  onComplete: () => void;
  completed: boolean;
}

function Step2Content({ onComplete, completed }: InteractiveStepProps) {
  const [placed, setPlaced] = useState(false);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.over?.id === "cell-target") {
        setPlaced(true);
        onComplete();
      }
    },
    [onComplete],
  );

  const showPlaced = placed || completed;

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-3xl font-pixel sm:text-4xl">Place a Piece</h2>
        <p className="min-h-18 max-w-sm text-center text-neutral-600">
          Drag a piece onto the board to claim a cell.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {["A", "B", "C", "D", "E", "F", "G", "H", "I"].map((cellId) => {
            const isTarget = cellId === "E";
            return (
              <TutorialCell
                key={cellId}
                id={isTarget ? "cell-target" : `cell-s2-${cellId}`}
                highlight={isTarget && !showPlaced}
                disabled={!isTarget}
              >
                {isTarget && showPlaced ? (
                  <div className="scale-110 transition-transform duration-300">
                    <StaticPiece size="medium" player="X" />
                  </div>
                ) : null}
              </TutorialCell>
            );
          })}
        </div>

        {/* Fixed height: swapping the piece for the success message must not move the board. */}
        <div className="flex h-32 flex-col items-center justify-center gap-2">
          {!showPlaced ? (
            <>
              <TutorialPiece id="drag-piece-step2" size="medium" player="X" />
              <span className="text-sm text-neutral-500 animate-pulse">
                ↑ Drag me to the glowing cell
              </span>
            </>
          ) : (
            <p className="font-semibold text-emerald-600">
              <Check className="mr-1 inline h-5 w-5" />
              Nice placement!
            </p>
          )}
        </div>
      </div>
    </DndContext>
  );
}

function Step3Content({ onComplete, completed }: InteractiveStepProps) {
  const [gobbled, setGobbled] = useState(false);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.over?.id === "gobble-target") {
        setGobbled(true);
        onComplete();
      }
    },
    [onComplete],
  );

  const showGobbled = gobbled || completed;

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-3xl font-pixel sm:text-4xl">Gobble!</h2>
        <p className="min-h-18 max-w-sm text-center text-neutral-600">
          A <span className="font-bold">larger</span> piece can cover a smaller one. Try gobbling
          the opponent&apos;s piece!
        </p>

        <div className="grid grid-cols-3 gap-2">
          {["A", "B", "C", "D", "E", "F", "G", "H", "I"].map((cellId) => {
            const isTarget = cellId === "E";
            return (
              <TutorialCell
                key={cellId}
                id={isTarget ? "gobble-target" : `cell-s3-${cellId}`}
                highlight={isTarget && !showGobbled}
                disabled={!isTarget}
              >
                {isTarget ? (
                  showGobbled ? (
                    <div className="scale-110 transition-transform duration-300">
                      <StaticPiece size="large" player="X" />
                    </div>
                  ) : (
                    <StaticPiece size="small" player="O" />
                  )
                ) : null}
              </TutorialCell>
            );
          })}
        </div>

        {/* Fixed height: swapping the piece for the success message must not move the board. */}
        <div className="flex h-32 flex-col items-center justify-center gap-2">
          {!showGobbled ? (
            <>
              <TutorialPiece id="drag-piece-step3" size="large" player="X" />
              <span className="text-sm text-neutral-500 animate-pulse">
                ↑ Drop the big piece on the small one
              </span>
            </>
          ) : (
            <p className="font-semibold text-emerald-600">
              <Check className="mr-1 inline h-5 w-5" />
              Your large piece gobbled the small one!
            </p>
          )}
        </div>
      </div>
    </DndContext>
  );
}

function Step4Content({ onComplete, completed }: InteractiveStepProps) {
  const [won, setWon] = useState(false);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.over?.id === "win-target") {
        setWon(true);
        onComplete();
      }
    },
    [onComplete],
  );

  const showWon = won || completed;

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col items-center gap-6">
        <h2 className="text-3xl font-pixel sm:text-4xl">Three in a Row</h2>
        <p className="min-h-18 max-w-sm text-center text-neutral-600">
          Get three of your <span className="font-bold">visible</span> pieces in a line — row,
          column, or diagonal. Complete the top row.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {["A", "B", "C", "D", "E", "F", "G", "H", "I"].map((cellId) => {
            const isTarget = cellId === "C";
            const hasPrePlaced = cellId === "A" || cellId === "B";

            return (
              <TutorialCell
                key={cellId}
                id={isTarget ? "win-target" : `cell-s4-${cellId}`}
                highlight={isTarget && !showWon}
                disabled={!isTarget}
              >
                {hasPrePlaced ? (
                  <StaticPiece size="medium" player="X" />
                ) : isTarget && showWon ? (
                  <div className="scale-110 transition-transform duration-300">
                    <StaticPiece size="medium" player="X" />
                  </div>
                ) : null}
              </TutorialCell>
            );
          })}
        </div>

        {/* Fixed height: swapping the piece for the success message must not move the board. */}
        <div className="flex h-32 flex-col items-center justify-center gap-2">
          {!showWon ? (
            <>
              <TutorialPiece id="drag-piece-step4" size="medium" player="X" />
              <span className="text-sm text-neutral-500 animate-pulse">
                ↑ Complete the top row!
              </span>
            </>
          ) : (
            <p className="text-lg font-bold text-emerald-600">You win! 🎉</p>
          )}
        </div>
      </div>
    </DndContext>
  );
}

function Step5Content() {
  return (
    <div className="flex flex-col items-center gap-6">
      <h2 className="text-3xl font-pixel sm:text-4xl">You&apos;re Ready!</h2>
      <p className="min-h-18 max-w-sm text-center text-neutral-600">
        You know everything you need. Time to play!
      </p>

      <div className="flex flex-col gap-3 rounded-xl bg-white p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Triangle fill="currentColor" strokeWidth={0} className="h-3 w-3 text-emerald-500" />
            <Square fill="currentColor" strokeWidth={0} className="h-4 w-4 text-emerald-500" />
            <Pentagon fill="currentColor" strokeWidth={0} className="h-5 w-5 text-emerald-500" />
          </div>
          <span className="text-sm text-neutral-700">Three sizes — more sides means bigger</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-5 w-9 items-center justify-center">
            <Pentagon fill="currentColor" strokeWidth={0} className="h-5 w-5 text-emerald-500" />
          </div>
          <span className="text-sm text-neutral-700">Bigger pieces gobble smaller ones</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-5 w-9 items-center justify-center gap-0.5">
            <Square fill="currentColor" strokeWidth={0} className="h-3 w-3 text-emerald-500" />
            <Square fill="currentColor" strokeWidth={0} className="h-3 w-3 text-emerald-500" />
            <Square fill="currentColor" strokeWidth={0} className="h-3 w-3 text-emerald-500" />
          </div>
          <span className="text-sm text-neutral-700">Three visible pieces in a line wins</span>
        </div>
      </div>

      <Link
        to="/game"
        className={buttonVariants({
          intent: "primary",
          className: "mt-2 px-8 py-3 text-lg",
        })}
      >
        Start Playing!
      </Link>

      <Link to="/" className="text-sm text-neutral-500 underline hover:text-neutral-700">
        Back to home
      </Link>
    </div>
  );
}

const TOTAL_STEPS = 5;

function TutorialPage() {
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const markComplete = useCallback((stepIndex: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(stepIndex);
      return next;
    });
  }, []);

  const canAdvance = step === 0 || step === 4 || completedSteps.has(step);
  const lastStep = step === TOTAL_STEPS - 1;
  const showBack = step > 0 && !lastStep;

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <>
      <main className="relative flex min-h-dvh flex-col items-center justify-center bg-neutral-100 p-4">
        {/*
          Every step is rendered in the same grid cell and only the current one is
          visible, so the stage is always as tall as the tallest step and moving
          between steps never shifts the title or the navigation.
        */}
        <div className="grid w-full max-w-lg">
          {[
            <Step1Content key={0} />,
            <Step2Content
              key={1}
              onComplete={() => markComplete(1)}
              completed={completedSteps.has(1)}
            />,
            <Step3Content
              key={2}
              onComplete={() => markComplete(2)}
              completed={completedSteps.has(2)}
            />,
            <Step4Content
              key={3}
              onComplete={() => markComplete(3)}
              completed={completedSteps.has(3)}
            />,
            <Step5Content key={4} />,
          ].map((content, index) => (
            <div
              key={index}
              inert={index !== step}
              className={
                index === step
                  ? "col-start-1 row-start-1"
                  : // Opacity, not just visibility: children inherit visibility and their
                    // transitions would keep the old step on screen while they run.
                    "invisible col-start-1 row-start-1 opacity-0"
              }
            >
              {content}
            </div>
          ))}
        </div>

        <div className="mt-8 flex w-full max-w-lg flex-col items-center gap-4 pb-4">
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
              let dotClass = "h-2.5 w-2.5 rounded-full transition-all duration-200";
              if (i === step) {
                dotClass += " bg-neutral-800 scale-125";
              } else if (completedSteps.has(i)) {
                dotClass += " bg-emerald-400";
              } else {
                dotClass += " border-2 border-neutral-300 bg-transparent";
              }
              return <div key={i} className={dotClass} />;
            })}
          </div>

          <div className="flex items-center gap-3">
            {/* Hidden rather than removed, so the controls never move. */}
            <button
              onClick={goBack}
              inert={!showBack}
              className={buttonVariants({
                intent: "secondary",
                className: !showBack && "invisible transition-none",
              })}
            >
              <ChevronLeft className="mr-1 inline h-4 w-4" />
              Back
            </button>
            <button
              onClick={goNext}
              disabled={!canAdvance}
              inert={lastStep}
              className={buttonVariants({
                intent: "primary",
                disabled: !canAdvance || undefined,
                className: lastStep && "invisible transition-none",
              })}
            >
              Next
              <ChevronRight className="ml-1 inline h-4 w-4" />
            </button>
          </div>

          <Link
            to="/game"
            inert={lastStep}
            className={`text-xs text-neutral-400 underline hover:text-neutral-600 ${lastStep ? "invisible" : ""}`}
          >
            Skip tutorial
          </Link>
        </div>
      </main>
    </>
  );
}
