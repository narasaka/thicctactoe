import { z } from 'zod';

export const sizeSchema = z.union([
  z.literal('small'),
  z.literal('medium'),
  z.literal('large'),
  z.null(),
  z.undefined(),
]);
export const playerSchema = z.union([
  z.literal('X'),
  z.literal('O'),
  z.null(),
  z.undefined(),
]);
export const tileSchema = z.object({
  id: z.string(),
  piece: z.union([z.string(), z.null()]),
  player: playerSchema,
  size: sizeSchema,
});
export const moveSchema = z.object({
  cell: z.string(),
  piece: z.string(),
  player: playerSchema,
});
export const gameStateSchema = z.object({
  board: z.array(tileSchema),
  turn: playerSchema,
  winner: playerSchema,
  moves: z.array(moveSchema),
});

export type Size = z.infer<typeof sizeSchema>;
export type Player = z.infer<typeof playerSchema>;
export type Tile = z.infer<typeof tileSchema>;
export type Move = z.infer<typeof moveSchema>;
export type GameState = z.infer<typeof gameStateSchema>;
