/**
 * SudokuForge – Validation (pure TypeScript, no framework imports).
 *
 * Validates board shape and constraints; used for mistake highlighting
 * and ensuring puzzles are well-formed before solving/generation.
 */

import type { Board, CellValue, Position } from './types';
import { isValidPlacement } from './solver';
import { GRID_SIZE } from './types';

/**
 * Returns true if the grid has 9 rows and 9 columns of values in 0–9.
 */
export function isValidBoardShape(board: unknown): board is Board {
  if (!Array.isArray(board) || board.length !== GRID_SIZE) return false;
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== GRID_SIZE) return false;
    for (const cell of row) {
      if (typeof cell !== 'number' || cell < 0 || cell > 9) return false;
    }
  }
  return true;
}

/**
 * Returns positions of cells that violate Sudoku rules (duplicate in row, col, or block).
 * Empty cells (0) are ignored; only filled cells are checked.
 */
export function getConflicts(board: Board): Position[] {
  const conflicts: Position[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const value = board[row][col] as CellValue;
      if (value !== 0 && !isValidPlacement(board, row, col, value)) {
        conflicts.push({ row, col });
      }
    }
  }
  return conflicts;
}

/**
 * Returns true if the board has no rule violations (no duplicates).
 * Empty cells are allowed.
 */
export function isValidPartialBoard(board: Board): boolean {
  return getConflicts(board).length === 0;
}
