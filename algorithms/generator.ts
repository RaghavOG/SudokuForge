/**
 * SudokuForge – Puzzle generator.
 * Pure TypeScript, no framework imports. Uses Math.random() for variety.
 *
 * Steps:
 * 1. Fill a complete 9×9 grid using backtracking (try digits in random order so each run differs).
 * 2. Remove cells one by one in random order; after each removal, check that the puzzle still has
 *    exactly one solution (countSolutions(..., 2) === 1). If not, put the value back.
 * 3. Difficulty = how many cells we keep as givens: easy = more givens, hard = fewer.
 */

import {
  type Board,
  type CellValue,
  type Difficulty,
  type MutableBoard,
  GRID_SIZE,
  cloneBoard,
  createEmptyBoard,
  freezeBoard,
} from './types';
import { countSolutions, isValidPlacement } from './solver';

/** Shuffles array in place (Fisher–Yates). Used to randomize digit order and removal order. */
function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Target number of givens (filled cells) per difficulty. Fewer = harder. */
const GIVENS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 42,
  medium: 34,
  hard: 26,
};

/**
 * Fills the board in-place with a valid complete grid.
 * Tries digits 1–9 in random order at each cell so we get different grids each time.
 */
function fillCompleteGrid(mutable: MutableBoard): boolean {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (mutable[row][col] !== 0) continue;
      const digits: CellValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      shuffle(digits);
      for (const value of digits) {
        if (!isValidPlacement(mutable, row, col, value)) continue;
        mutable[row][col] = value;
        if (fillCompleteGrid(mutable)) return true;
        mutable[row][col] = 0;
      }
      return false;
    }
  }
  return true;
}

/**
 * Builds a new complete valid Sudoku grid (all 81 cells filled).
 */
function generateFullGrid(): MutableBoard {
  const board = createEmptyBoard();
  fillCompleteGrid(board);
  return board;
}

/**
 * Removes cells from a complete grid to form a puzzle with exactly one solution.
 * Tries removing in random order; keeps removal only if the puzzle still has unique solution.
 */
function removeCellsKeepingUniqueSolution(
  board: MutableBoard,
  targetGivens: number
): void {
  const positions: { row: number; col: number }[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      positions.push({ row, col });
    }
  }
  shuffle(positions);

  let givensCount = GRID_SIZE * GRID_SIZE;
  for (const { row, col } of positions) {
    if (givensCount <= targetGivens) break;
    const value = board[row][col];
    board[row][col] = 0;
    const solutions = countSolutions(board, 2);
    if (solutions === 1) {
      givensCount--;
    } else {
      board[row][col] = value;
    }
  }
}

export interface GeneratedPuzzle {
  puzzle: Board;
  solution: Board;
}

/**
 * Generates a new puzzle for the given difficulty.
 * Returns the puzzle (board with zeros where the user fills in) and the full solution.
 */
export function generatePuzzle(difficulty: Difficulty): GeneratedPuzzle {
  const solution = generateFullGrid();
  const puzzle = cloneBoard(solution);
  const targetGivens = GIVENS_BY_DIFFICULTY[difficulty];
  removeCellsKeepingUniqueSolution(puzzle, targetGivens);
  return {
    puzzle: freezeBoard(puzzle),
    solution: freezeBoard(solution),
  };
}
