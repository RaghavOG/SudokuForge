'use client';

/**
 * 9×9 Sudoku grid. Givens read-only; empty cells editable.
 * Selected cell + full row/column/block highlight with animation.
 */

import type { Board, CellValue, Position } from '@/algorithms';
import { GRID_SIZE, BLOCK_SIZE } from '@/algorithms';

interface SudokuGridProps {
  board: Board;
  givenMask: readonly (readonly boolean[])[];
  solution: Board | null;
  selectedCell: Position | null;
  conflictPositions: readonly Position[];
  completedRows: ReadonlySet<number>;
  completedCols: ReadonlySet<number>;
  completedBlocks: ReadonlySet<number>;
  onSelectCell: (pos: Position) => void;
  onCellChange: (row: number, col: number, value: CellValue) => void;
}

function isMistake(
  board: Board,
  solution: Board | null,
  row: number,
  col: number
): boolean {
  if (!solution) return false;
  const v = board[row][col];
  return v !== 0 && solution[row][col] !== v;
}

function sameBlock(r1: number, c1: number, r2: number, c2: number): boolean {
  return (
    Math.floor(r1 / BLOCK_SIZE) === Math.floor(r2 / BLOCK_SIZE) &&
    Math.floor(c1 / BLOCK_SIZE) === Math.floor(c2 / BLOCK_SIZE)
  );
}

function blockIndex(row: number, col: number): number {
  return (
    Math.floor(row / BLOCK_SIZE) * 3 + Math.floor(col / BLOCK_SIZE)
  );
}

const CELL_SIZE = '2.75rem';

export function SudokuGrid({
  board,
  givenMask,
  solution,
  selectedCell,
  conflictPositions,
  completedRows,
  completedCols,
  completedBlocks,
  onSelectCell,
  onCellChange,
}: SudokuGridProps) {
  const conflictSet = new Set(
    conflictPositions.map((p) => `${p.row},${p.col}`)
  );

  function handleKeyDown(e: React.KeyboardEvent, row: number, col: number) {
    if (givenMask[row][col]) return;
    if (e.key >= '1' && e.key <= '9') {
      onCellChange(row, col, Number(e.key) as CellValue);
      e.preventDefault();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      onCellChange(row, col, 0);
      e.preventDefault();
    }
  }

  return (
    <div
      className="inline-grid gap-0 rounded-lg bg-white dark:bg-slate-800"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE})`,
        gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE})`,
        boxShadow: 'var(--shadow)',
      }}
      role="grid"
      aria-label="Sudoku grid"
    >
      {Array.from({ length: GRID_SIZE }, (_, row) =>
        Array.from({ length: GRID_SIZE }, (_, col) => {
          const value = board[row][col];
          const isGiven = givenMask[row][col];
          const isSelected =
            selectedCell?.row === row && selectedCell?.col === col;
          const isInSelectedRow = selectedCell ? selectedCell.row === row : false;
          const isInSelectedCol = selectedCell ? selectedCell.col === col : false;
          const isInSelectedBlock =
            selectedCell !== null &&
            sameBlock(row, col, selectedCell.row, selectedCell.col);
          const selectedValue =
            selectedCell !== null
              ? board[selectedCell.row][selectedCell.col]
              : 0;
          const isSameDigit =
            !isSelected &&
            value !== 0 &&
            selectedValue !== 0 &&
            value === selectedValue;
          const isRowComplete = completedRows.has(row);
          const isColComplete = completedCols.has(col);
          const isBlockComplete = completedBlocks.has(blockIndex(row, col));
          const isComplete =
            isRowComplete || isColComplete || isBlockComplete;
          const isConflict = conflictSet.has(`${row},${col}`);
          const wrongVsSolution = isMistake(board, solution, row, col);
          const isBlockEdgeRight =
            (col + 1) % BLOCK_SIZE === 0 && col !== GRID_SIZE - 1;
          const isBlockEdgeBottom =
            (row + 1) % BLOCK_SIZE === 0 && row !== GRID_SIZE - 1;

          let cellBg = 'bg-white';
          if (isSelected) {
            cellBg = 'sudoku-cell-selected';
          } else if (wrongVsSolution) {
            cellBg = 'bg-red-50 dark:bg-red-900/30';
          } else if (isConflict) {
            cellBg = 'bg-red-50/60 dark:bg-red-900/20';
          } else if (isComplete) {
            cellBg = 'sudoku-cell-complete';
          } else if (isSameDigit) {
            cellBg = 'sudoku-cell-same-digit';
          } else if (isInSelectedRow || isInSelectedCol || isInSelectedBlock) {
            cellBg = 'sudoku-cell-highlight';
          }           else if (isGiven) {
            cellBg = 'bg-slate-50/80 dark:bg-slate-700/50';
          }

          let textColor = 'text-slate-800 dark:text-slate-200';
          if (wrongVsSolution) textColor = 'text-red-600 dark:text-red-400 font-semibold';
          else if (isGiven) textColor = 'text-slate-900 dark:text-slate-100 font-semibold';

          return (
            <div
              key={`${row}-${col}`}
              className={`
                flex items-center justify-center border border-slate-200 dark:border-slate-600
                text-center text-xl tabular-nums transition-colors duration-150
                ${cellBg} ${textColor}
                ${isSelected ? 'ring-2 ring-indigo-500 ring-inset dark:ring-indigo-400' : ''}
                ${isBlockEdgeRight ? 'border-r-2 border-r-slate-400 dark:border-r-slate-500' : ''}
                ${isBlockEdgeBottom ? 'border-b-2 border-b-slate-400 dark:border-b-slate-500' : ''}
                cursor-pointer select-none
              `}
              onClick={() => onSelectCell({ row, col })}
              onKeyDown={(e) => handleKeyDown(e, row, col)}
              tabIndex={0}
              role="gridcell"
              aria-readonly={isGiven}
              aria-label={
                isGiven
                  ? `Given ${value}`
                  : value
                    ? `Cell ${value}`
                    : 'Empty cell'
              }
            >
              {value !== 0 ? value : ''}
            </div>
          );
        })
      )}
    </div>
  );
}
