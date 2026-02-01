/**
 * SudokuForge – Backtracking solver.
 * Pure, deterministic, framework-agnostic (no React/Next).
 *
 * Algorithm: constraint propagation + backtracking.
 * - Try placing digits 1–9 in empty cells.
 * - Only place if the digit is valid (no conflict in row, column, or 3×3 block).
 * - Recurse; on failure, backtrack and try the next digit.
 */

import {
  type Board,
  type CellValue,
  type MutableBoard,
  BLOCK_SIZE,
  GRID_SIZE,
  cloneBoard,
  createEmptyBoard,
} from './types';

/** Returns the next empty cell (row, col) or null if board is full. */
function findEmptyCell(board: Board): { row: number; col: number } | null {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (board[row][col] === 0) return { row, col };
    }
  }
  return null;
}

/**
 * Checks if placing `value` at (row, col) is valid:
 * - Not already in the same row
 * - Not already in the same column
 * - Not already in the same 3×3 block
 */
export function isValidPlacement(
  board: Board,
  row: number,
  col: number,
  value: CellValue
): boolean {
  if (value === 0) return true;

  // Same row
  for (let c = 0; c < GRID_SIZE; c++) {
    if (c !== col && board[row][c] === value) return false;
  }

  // Same column
  for (let r = 0; r < GRID_SIZE; r++) {
    if (r !== row && board[r][col] === value) return false;
  }

  // Same 3×3 block (top-left of block)
  const blockRow = Math.floor(row / BLOCK_SIZE) * BLOCK_SIZE;
  const blockCol = Math.floor(col / BLOCK_SIZE) * BLOCK_SIZE;
  for (let r = blockRow; r < blockRow + BLOCK_SIZE; r++) {
    for (let c = blockCol; c < blockCol + BLOCK_SIZE; c++) {
      if ((r !== row || c !== col) && board[r][c] === value) return false;
    }
  }

  return true;
}

/**
 * Returns true if the board is fully filled and valid (no duplicates).
 */
export function isBoardComplete(board: Board): boolean {
  const cell = findEmptyCell(board);
  if (cell !== null) return false;
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const value = board[row][col];
      if (value === 0) return false;
      if (!isValidPlacement(board, row, col, value)) return false;
    }
  }
  return true;
}

/**
 * Solves the board in-place using backtracking.
 * Returns true if a solution exists and the board is now filled; false if unsolvable.
 * Modifies the given mutable board.
 */
function solveBacktrack(mutable: MutableBoard): boolean {
  const cell = findEmptyCell(mutable);
  if (cell === null) return true;

  const { row, col } = cell;
  const digits: CellValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  for (const value of digits) {
    if (!isValidPlacement(mutable, row, col, value)) continue;
    mutable[row][col] = value;
    if (solveBacktrack(mutable)) return true;
    mutable[row][col] = 0;
  }
  return false;
}

/**
 * Solves the given board and returns a new solved board, or null if unsolvable.
 * Does not mutate the input.
 */
export function solve(board: Board): MutableBoard | null {
  const mutable = cloneBoard(board);
  return solveBacktrack(mutable) ? mutable : null;
}

/**
 * Counts how many solutions the board has, up to a limit (e.g. 2 to detect multiple solutions).
 * Used by the generator to ensure exactly one solution.
 */
export function countSolutions(board: Board, limit: number): number {
  const mutable = cloneBoard(board);
  let count = 0;

  function countBacktrack(m: MutableBoard): void {
    if (count >= limit) return;
    const cell = findEmptyCell(m);
    if (cell === null) {
      count++;
      return;
    }
    const { row, col } = cell;
    const digits: CellValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const value of digits) {
      if (!isValidPlacement(m, row, col, value)) continue;
      m[row][col] = value;
      countBacktrack(m);
      if (count >= limit) return;
      m[row][col] = 0;
    }
  }

  countBacktrack(mutable);
  return count;
}

/**
 * Returns true if the board has exactly one solution.
 */
export function hasUniqueSolution(board: Board): boolean {
  return countSolutions(board, 2) === 1;
}
