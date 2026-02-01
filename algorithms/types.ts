/**
 * SudokuForge – Type definitions for board, cell, and game state.
 * All types are framework-agnostic (no React/Next).
 */

/** Valid cell value: 1–9 for filled, 0 for empty. */
export type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Position on the 9×9 grid (0-based row and column). */
export interface Position {
  row: number;
  col: number;
}

/**
 * Board representation: 9 rows × 9 columns.
 * Each cell is a CellValue; 0 means empty.
 */
export type Board = readonly (readonly CellValue[])[];

/** Mutable board type used during solving/generation (same shape as Board). */
export type MutableBoard = CellValue[][];

/** Size of one block (3×3) and the full grid. */
export const BLOCK_SIZE = 3;
export const GRID_SIZE = 9;

/**
 * Difficulty affects how many cells are removed after generation.
 * More removals → fewer givens → harder (more branching).
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Game state for the UI layer.
 * - board: current cell values (user edits + givens)
 * - givenMask: true for clue cells that cannot be changed
 * - notes: pencil marks per cell (optional, for components)
 */
export interface GameState {
  board: Board;
  givenMask: readonly (readonly boolean[])[];
  difficulty: Difficulty;
}

/**
 * Builds an empty 9×9 board (all zeros).
 */
export function createEmptyBoard(): MutableBoard {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, (): CellValue => 0)
  );
}

/**
 * Deep-clones a board into a mutable copy.
 */
export function cloneBoard(board: Board): MutableBoard {
  return board.map((row) => [...row]) as MutableBoard;
}

/**
 * Returns a read-only view of a board (for passing to pure functions).
 */
export function freezeBoard(board: MutableBoard): Board {
  return board.map((row) => [...row] as readonly CellValue[]) as Board;
}
