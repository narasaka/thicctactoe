import { z } from 'zod';

const sizeSchema = z.number().min(0).max(3);
const playerSchema = z.union([
  z.literal('X'),
  z.literal('O'),
  z.null(),
  z.undefined(),
]);
const tileSchema = z.object({
  id: z.string(),
  piece: z.union([z.string(), z.null()]),
  player: playerSchema,
  size: sizeSchema,
});
const moveSchema = z.object({
  cell: z.string(),
  piece: z.string(),
  player: playerSchema,
});
const gameStateSchema = z.object({
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
