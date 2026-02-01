'use client';

/**
 * Renders the 9×9 Sudoku grid. Givens read-only; empty cells editable.
 * Light blue = selected; red = mistake (wrong vs solution) or conflict.
 */

import type { Board, CellValue, Position } from '@/algorithms';
import { GRID_SIZE, BLOCK_SIZE } from '@/algorithms';

interface SudokuGridProps {
  board: Board;
  givenMask: readonly (readonly boolean[])[];
  solution: Board | null;
  selectedCell: Position | null;
  conflictPositions: readonly Position[];
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

export function SudokuGrid({
  board,
  givenMask,
  solution,
  selectedCell,
  conflictPositions,
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
      className="inline-grid gap-0 border-2 border-zinc-800"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, 2.25rem)`,
        gridTemplateRows: `repeat(${GRID_SIZE}, 2.25rem)`,
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
          const isConflict = conflictSet.has(`${row},${col}`);
          const wrongVsSolution = isMistake(board, solution, row, col);
          const isBlockEdgeRight =
            (col + 1) % BLOCK_SIZE === 0 && col !== GRID_SIZE - 1;
          const isBlockEdgeBottom =
            (row + 1) % BLOCK_SIZE === 0 && row !== GRID_SIZE - 1;

          let cellBg = 'bg-white';
          if (isSelected) cellBg = 'bg-blue-100';
          else if (wrongVsSolution) cellBg = 'bg-red-100';
          else if (isConflict) cellBg = 'bg-red-50';
          else if (isGiven) cellBg = 'bg-white';

          let textColor = 'text-zinc-900';
          if (wrongVsSolution) textColor = 'text-red-600';

          return (
            <div
              key={`${row}-${col}`}
              className={`
                flex items-center justify-center border border-zinc-300
                text-center text-lg tabular-nums font-medium
                ${cellBg} ${textColor}
                ${isSelected ? 'ring-2 ring-inset ring-blue-400' : ''}
                ${isBlockEdgeRight ? 'border-r-2 border-r-zinc-600' : ''}
                ${isBlockEdgeBottom ? 'border-b-2 border-b-zinc-600' : ''}
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
