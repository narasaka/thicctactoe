import type { RatingPoint } from "@thicctactoe/api/arena";
import { cn } from "@thicctactoe/ui/lib/utils";
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";

const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };
const TICK_STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500];
const MAX_TICKS = 4;

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** Round rating ticks covering `min`..`max`, at most `MAX_TICKS` of them. */
function ticks(min: number, max: number) {
  const step =
    TICK_STEPS.find((step) => Math.ceil(max / step) - Math.floor(min / step) <= MAX_TICKS - 1) ??
    TICK_STEPS.at(-1)!;
  const from = Math.floor(min / step) * step;
  const to = Math.ceil(max / step) * step;
  return Array.from({ length: (to - from) / step + 1 }, (_, index) => from + index * step);
}

/**
 * A player's rating over their games: one step per game, so a burst of play
 * reads as clearly as a quiet month. Hover or arrow keys read out each game.
 */
export default function RatingChart({
  ratings,
  played,
  className,
}: {
  ratings: RatingPoint[];
  /** Games the player has finished in all, which may be more than the chart covers. */
  played: number;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const values = ratings.map((point) => point.rating);
  const yTicks = ticks(Math.min(...values), Math.max(...values));
  const low = yTicks[0]!;
  const high = yTicks.at(-1)!;
  const plotWidth = Math.max(width - PAD.left - PAD.right, 1);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (index / Math.max(ratings.length - 1, 1)) * plotWidth;
  const y = (rating: number) =>
    PAD.top + (high === low ? plotHeight / 2 : ((high - rating) / (high - low)) * plotHeight);

  const line = ratings
    .map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.rating)}`)
    .join("");
  const area = `${line}L${x(ratings.length - 1)},${PAD.top + plotHeight}L${x(0)},${PAD.top + plotHeight}Z`;

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const left = event.currentTarget.getBoundingClientRect().left;
    const ratio = (event.clientX - left - PAD.left) / plotWidth;
    setActive(Math.min(Math.max(Math.round(ratio * (ratings.length - 1)), 0), ratings.length - 1));
  };
  const step = (event: KeyboardEvent<SVGSVGElement>) => {
    const last = ratings.length - 1;
    const next = {
      ArrowLeft: (active ?? last) - 1,
      ArrowRight: (active ?? -1) + 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(Math.min(Math.max(next, 0), last));
  };

  const first = ratings[0]!;
  const latest = ratings.at(-1)!;
  const point = active === null ? null : ratings[active]!;
  const delta = active ? point!.rating - ratings[active - 1]!.rating : null;
  const games = ratings.length - 1;
  /** Number of the first game the chart covers, counting from the player's first ever. */
  const firstGame = played - games + 1;

  return (
    <div ref={container} className={cn("relative", className)}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Rating went from ${first.rating} to ${latest.rating} over ${games} ${games === 1 ? "game" : "games"}`}
          tabIndex={0}
          className="block touch-pan-y outline-none"
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
          onKeyDown={step}
          onBlur={() => setActive(null)}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-neutral-100"
              />
              <text
                x={PAD.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-neutral-400 font-mono text-[11px]"
              >
                {tick}
              </text>
            </g>
          ))}
          <text x={x(0)} y={HEIGHT - 6} textAnchor="start" className="fill-neutral-400 text-[11px]">
            {dayFormat.format(first.at)}
          </text>
          <text
            x={x(ratings.length - 1)}
            y={HEIGHT - 6}
            textAnchor="end"
            className="fill-neutral-400 text-[11px]"
          >
            {dayFormat.format(latest.at)}
          </text>
          <path d={area} className="fill-neutral-800/10" />
          <path
            d={line}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-neutral-800"
          />
          {point && (
            <>
              <line
                x1={x(active!)}
                x2={x(active!)}
                y1={PAD.top}
                y2={PAD.top + plotHeight}
                className="stroke-neutral-300"
              />
              <circle
                cx={x(active!)}
                cy={y(point.rating)}
                r={4.5}
                strokeWidth={2}
                className="fill-neutral-800 stroke-white"
              />
            </>
          )}
        </svg>
      )}
      {point && (
        <div
          className={cn(
            "pointer-events-none absolute top-0 rounded-lg bg-white px-3 py-2 text-xs whitespace-nowrap shadow-md ring-1 ring-neutral-100",
            // Keep the readout on the far side of the crosshair from the edge it nears.
            x(active!) > width / 2 ? "-translate-x-full -ml-3" : "ml-3",
          )}
          style={{ left: x(active!) }}
        >
          <div className="text-neutral-500">
            {active === 0 ? `Before game ${firstGame}` : `Game ${firstGame + active! - 1}`} ·{" "}
            {dayFormat.format(point.at)}
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold text-neutral-800">{point.rating}</span>
            {delta !== null && (
              <span className={cn("font-mono", delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {delta >= 0 ? `+${delta}` : delta}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
