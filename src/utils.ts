import type { Tile } from './models';

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

export const numerizedSize = (size: string) => {
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
