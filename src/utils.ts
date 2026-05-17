import type { Move, Player, Tile } from './models';

const pieceInventory = {
  small: 5,
  medium: 3,
  large: 1,
} as const;

type PieceSize = keyof typeof pieceInventory;

const pieceSizes = ['small', 'medium', 'large'] as const;

export const checkWinner = (board: Tile[]) => {
  const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ] as const;
  for (const combination of winningCombinations) {
    const [a, b, c] = combination;
    if (
      board[a] &&
      board[a]?.player &&
      board[a]?.player === board[b]?.player &&
      board[a]?.player === board[c]?.player
    ) {
      return board[a]?.player;
    }
  }
  return null;
};

export const numerizedSize = (size: string | null | undefined) => {
  switch (size) {
    case 'small':
      return 1;
    case 'medium':
      return 2;
    case 'large':
      return 3;
    default:
      return 0;
  }
};

export const hasLegalMove = (board: Tile[], moves: Move[], player: Player) => {
  if (!player) return false;

  const remainingPieces: Record<PieceSize, number> = { ...pieceInventory };

  for (const move of moves) {
    if (move.player !== player) continue;

    const size = idToSize(move.piece);
    remainingPieces[size] -= 1;
  }

  return board.some((tile) => {
    if (tile.player === null || tile.piece === null || !tile.size) {
      return pieceSizes.some((size) => remainingPieces[size] > 0);
    }

    const tileSize = tile.size;

    return pieceSizes.some((size) => {
      if (remainingPieces[size] <= 0) return false;

      return numerizedSize(size) > numerizedSize(tileSize);
    });
  });
};

export const idToNumerizedSize = (id: string) => {
  const num = parseInt(id);
  if (isNaN(num)) return 0;
  if (num % 9 < 5) return 1;
  if (num % 9 < 8) return 2;
  return 3;
};

export const idToSize = (id: string) => {
  const num = parseInt(id);
  if (isNaN(num)) return 'small';
  if (num % 9 < 5) return 'small';
  if (num % 9 < 8) return 'medium';
  return 'large';
};
