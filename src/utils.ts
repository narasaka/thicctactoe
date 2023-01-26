import { Tile } from './models';

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
      board[a]?.player &&
      board[a]?.player === board[b]?.player &&
      board[a]?.player === board[c]?.player
    ) {
      return board[a]?.player;
    }
  }
  return null;
};
