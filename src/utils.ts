import type { Size, Tile, Winner } from './models';

export const checkWinner = (board: Tile[]): Winner => {
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
      board[a]!.player &&
      board[a]!.player === board[b]?.player &&
      board[a]!.player === board[c]?.player
    ) {
      return board[a]!.player;
    }
  }
  return null;
};

export const sizeToText = (size?: Size) => {
  if (!size) return '';
  if (size === 1) return 'S';
  if (size === 2) return 'M';
  if (size === 3) return 'L';
};

export const getStyleFromSize = (size?: Size) => {
  if (!size) return '';
  if (size === 1) return 'm-5 h-10 w-10';
  if (size === 2) return 'm-3 h-14 w-14';
  if (size === 3) return 'h-20 w-20';
};
