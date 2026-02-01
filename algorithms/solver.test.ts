/**
 * Sanity check for the backtracking solver (run with npx tsx or ts-node).
 * Not a full test suite; validates that solve() works on a known puzzle.
 */

import { solve, isBoardComplete, hasUniqueSolution } from './solver';
import type { Board } from './types';

// Classic hard puzzle (one solution)
const PUZZLE: Board = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

const solved = solve(PUZZLE);
if (!solved) {
  console.error('Solver failed: no solution returned');
  process.exit(1);
}
if (!isBoardComplete(solved)) {
  console.error('Solver returned incomplete or invalid board');
  process.exit(1);
}
if (!hasUniqueSolution(PUZZLE)) {
  console.error('Puzzle should have unique solution');
  process.exit(1);
}
console.log('Solver sanity check passed.');
console.log('Solved board (first row):', solved[0].join(' '));
