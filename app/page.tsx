'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SudokuGrid } from '@/components/SudokuGrid';
import {
  UndoIcon,
  EraseIcon,
  PencilIcon,
  HintIcon,
  PauseIcon,
} from '@/components/GameIcons';
import { getConflicts } from '@/algorithms';
import { loadGame, saveGame, clearGame } from '@/lib/persist';
import type { Board, CellValue, Difficulty, Position } from '@/algorithms';

const MAX_MISTAKES = 3;
const MAX_HINTS = 3;

function buildGivenMask(puzzle: Board): boolean[][] {
  return puzzle.map((row) =>
    row.map((cell) => cell !== 0)
  ) as boolean[][];
}

function copyBoard(board: Board): CellValue[][] {
  return board.map((row) => [...row]) as CellValue[][];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Home() {
  const [puzzle, setPuzzle] = useState<Board | null>(null);
  const [solution, setSolution] = useState<Board | null>(null);
  const [givenMask, setGivenMask] = useState<readonly (readonly boolean[])[]>(
    []
  );
  const [board, setBoard] = useState<CellValue[][]>([]);
  const [selectedCell, setSelectedCell] = useState<Position | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [undoStack, setUndoStack] = useState<CellValue[][][]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [notesMode, setNotesMode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPuzzle = useCallback(async () => {
    setLoading(true);
    setError(null);
    clearGame();
    try {
      const res = await fetch(`/api/puzzle?difficulty=${difficulty}`);
      if (!res.ok) throw new Error('Failed to load puzzle');
      const data = await res.json();
      setPuzzle(data.puzzle);
      setSolution(data.solution);
      setGivenMask(buildGivenMask(data.puzzle));
      setBoard(copyBoard(data.puzzle));
      setSelectedCell(null);
      setUndoStack([]);
      setMistakes(0);
      setHintsLeft(MAX_HINTS);
      setTimerSeconds(0);
      setTimerPaused(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [difficulty]);

  // Restore from localStorage on mount, or fetch new puzzle
  useEffect(() => {
    const saved = loadGame();
    if (saved?.puzzle?.length && saved?.board?.length) {
      setPuzzle(saved.puzzle as Board);
      setSolution(saved.solution as Board);
      setGivenMask(saved.givenMask as readonly (readonly boolean[])[]);
      setBoard(saved.board as CellValue[][]);
      setDifficulty((saved.difficulty as Difficulty) || 'easy');
      setTimerSeconds(saved.timerSeconds ?? 0);
      setTimerPaused(saved.timerPaused ?? false);
      setMistakes(saved.mistakes ?? 0);
      setHintsLeft(saved.hintsLeft ?? MAX_HINTS);
      setSelectedCell(saved.selectedCell);
      setUndoStack([]);
      setLoading(false);
    } else {
      fetchPuzzle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to localStorage (debounced) when game state changes
  useEffect(() => {
    if (!puzzle?.length || !board?.length) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveGame({
        puzzle,
        solution: solution ?? [],
        givenMask: givenMask as boolean[][],
        board,
        difficulty,
        timerSeconds,
        timerPaused,
        mistakes,
        hintsLeft,
        selectedCell,
      });
      saveTimeoutRef.current = null;
    }, 400);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [
    puzzle,
    solution,
    givenMask,
    board,
    difficulty,
    timerSeconds,
    timerPaused,
    mistakes,
    hintsLeft,
    selectedCell,
  ]);

  useEffect(() => {
    if (loading || !puzzle?.length || timerPaused) return;
    timerRef.current = setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, puzzle?.length, timerPaused]);

  const handleCellChange = useCallback(
    (row: number, col: number, value: CellValue) => {
      if (givenMask[row]?.[col]) return;
      setBoard((prev) => {
        setUndoStack((u) => [...u, copyBoard(prev)]);
        const next = prev.map((r) => [...r]) as CellValue[][];
        next[row][col] = value;
        return next;
      });
      if (value !== 0 && solution?.[row]?.[col] !== value) {
        setMistakes((m) => Math.min(m + 1, MAX_MISTAKES));
      }
    },
    [givenMask, solution]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setBoard(copyBoard(prev));
  }, [undoStack.length]);

  const handleErase = useCallback(() => {
    if (!selectedCell || givenMask[selectedCell.row]?.[selectedCell.col])
      return;
    setUndoStack((prev) => [...prev, copyBoard(board)]);
    setBoard((prev) => {
      const next = prev.map((r) => [...r]) as CellValue[][];
      next[selectedCell.row][selectedCell.col] = 0;
      return next;
    });
  }, [selectedCell, givenMask, board]);

  const handleHint = useCallback(() => {
    if (
      hintsLeft <= 0 ||
      !selectedCell ||
      !solution ||
      givenMask[selectedCell.row]?.[selectedCell.col]
    )
      return;
    const { row, col } = selectedCell;
    if (board[row][col] !== 0) return;
    setUndoStack((prev) => [...prev, copyBoard(board)]);
    setBoard((prev) => {
      const next = prev.map((r) => [...r]) as CellValue[][];
      next[row][col] = solution[row][col];
      return next;
    });
    setHintsLeft((h) => h - 1);
  }, [hintsLeft, selectedCell, solution, givenMask, board]);

  const handleNumberPad = useCallback(
    (digit: CellValue) => {
      if (!selectedCell) return;
      handleCellChange(selectedCell.row, selectedCell.col, digit);
    },
    [selectedCell, handleCellChange]
  );

  const conflictPositions = puzzle?.length
    ? getConflicts(board)
    : [];

  const conflictSet = useMemo(
    () => new Set(conflictPositions.map((p) => `${p.row},${p.col}`)),
    [conflictPositions]
  );

  const { completedRows, completedCols, completedBlocks } = useMemo(() => {
    const rows = new Set<number>();
    const cols = new Set<number>();
    const blocks = new Set<number>();
    if (!board?.length) return { completedRows: rows, completedCols: cols, completedBlocks: blocks };
    for (let r = 0; r < 9; r++) {
      let full = true;
      let noConflict = true;
      for (let c = 0; c < 9; c++) {
        if (board[r][c] < 1 || board[r][c] > 9) full = false;
        if (conflictSet.has(`${r},${c}`)) noConflict = false;
      }
      if (full && noConflict) rows.add(r);
    }
    for (let c = 0; c < 9; c++) {
      let full = true;
      let noConflict = true;
      for (let r = 0; r < 9; r++) {
        if (board[r][c] < 1 || board[r][c] > 9) full = false;
        if (conflictSet.has(`${r},${c}`)) noConflict = false;
      }
      if (full && noConflict) cols.add(c);
    }
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const blockIndex = br * 3 + bc;
        let full = true;
        let noConflict = true;
        for (let r = br * 3; r < br * 3 + 3; r++) {
          for (let c = bc * 3; c < bc * 3 + 3; c++) {
            if (board[r][c] < 1 || board[r][c] > 9) full = false;
            if (conflictSet.has(`${r},${c}`)) noConflict = false;
          }
        }
        if (full && noConflict) blocks.add(blockIndex);
      }
    }
    return { completedRows: rows, completedCols: cols, completedBlocks: blocks };
  }, [board, conflictSet]);

  if (loading && !puzzle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading puzzle…</p>
        </div>
      </div>
    );
  }

  if (error && !puzzle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <p className="text-center text-slate-600">{error}</p>
        <button
          type="button"
          onClick={fetchPuzzle}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!puzzle?.length) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              SudokuForge
            </h1>
            <nav className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    difficulty === d
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">
              <span className="text-xs font-medium text-slate-500">
                Mistakes
              </span>
              <span
                className={`tabular-nums font-semibold ${
                  mistakes >= MAX_MISTAKES ? 'text-red-600' : 'text-slate-700'
                }`}
              >
                {mistakes}/{MAX_MISTAKES}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">
              <span className="tabular-nums text-sm font-medium text-slate-700">
                {formatTime(timerSeconds)}
              </span>
              <button
                type="button"
                onClick={() => setTimerPaused((p) => !p)}
                className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                aria-label={timerPaused ? 'Resume' : 'Pause'}
              >
                <PauseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Intro */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-slate-600">
            Fill each row, column, and 3×3 box with the digits 1–9, no repeats.
            Click a cell and type a number or use the number pad. Your progress
            is saved automatically.
          </p>
        </section>

        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-start lg:gap-12">
          {/* Grid */}
          <div className="flex flex-col items-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <SudokuGrid
                board={board}
                givenMask={givenMask}
                solution={solution}
                selectedCell={selectedCell}
                conflictPositions={conflictPositions}
                completedRows={completedRows}
                completedCols={completedCols}
                completedBlocks={completedBlocks}
                onSelectCell={setSelectedCell}
                onCellChange={handleCellChange}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex w-full shrink-0 flex-col gap-6 sm:w-52">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100"
                  aria-label="Undo"
                >
                  <UndoIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleErase}
                  disabled={
                    !selectedCell ||
                    givenMask[selectedCell?.row]?.[selectedCell?.col]
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100"
                  aria-label="Erase"
                >
                  <EraseIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setNotesMode((n) => !n)}
                  className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    notesMode
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  aria-label="Notes"
                >
                  <PencilIcon className="h-5 w-5" />
                  <span className="absolute -top-0.5 right-0.5 text-[10px] font-medium text-slate-400">
                    {notesMode ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleHint}
                  disabled={
                    hintsLeft <= 0 ||
                    !selectedCell ||
                    (selectedCell &&
                      board[selectedCell.row]?.[selectedCell.col] !== 0)
                  }
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100"
                  aria-label="Hint"
                >
                  <HintIcon className="h-5 w-5" />
                  {hintsLeft > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                      {hintsLeft}
                    </span>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleNumberPad(n)}
                    className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-100 text-lg font-semibold text-slate-800 transition-colors hover:bg-slate-200 active:scale-[0.98]"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={fetchPuzzle}
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'New game'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
