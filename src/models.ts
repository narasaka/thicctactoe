import type { UniqueIdentifier } from '@dnd-kit/core';

export type Size = 0 | 1 | 2 | 3;
export type Winner = 'X' | 'O' | null;
export type Player = 'X' | 'O';
export type Tile = {
  id: UniqueIdentifier;
  piece: UniqueIdentifier | null;
  player: Player | null;
  size: Size;
};
export interface Move {
  cell: UniqueIdentifier;
  piece: UniqueIdentifier;
  player: Player;
}
export interface GameState {
  board: Tile[];
  turn: Player;
  winner: Winner;
  moves: Move[];
}
