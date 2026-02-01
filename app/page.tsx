'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SudokuGrid } from '@/components/SudokuGrid';
import {
  UndoIcon,
  RedoIcon,
  EraseIcon,
  PencilIcon,
  HintIcon,
  PauseIcon,
} from '@/components/GameIcons';
import { getConflicts, isBoardComplete } from '@/algorithms';
import {
  loadGame,
  saveGame,
  clearGame,
  getBestTime,
  setBestTime,
} from '@/lib/persist';
import type { Board, CellValue, Difficulty, Position } from '@/algorithms';

const MAX_MISTAKES = 3;
const MAX_HINTS = 3;
const THEME_KEY = 'sudokuforge-theme';

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

function findNextEmptyCell(board: Board, fromRow: number, fromCol: number): Position | null {
  let r = fromRow;
  let c = fromCol + 1;
  if (c > 8) {
    c = 0;
    r++;
  }
  if (r > 8) r = 0;
  for (let i = 0; i < 81; i++) {
    if (board[r][c] === 0) return { row: r, col: c };
    c++;
    if (c > 8) {
      c = 0;
      r++;
    }
    if (r > 8) r = 0;
  }
  return null;
}

function findFirstEmptyCell(board: Board): Position | null {
  return findNextEmptyCell(board, 0, -1);
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
  const [redoStack, setRedoStack] = useState<CellValue[][][]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [notesMode, setNotesMode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(stored || prefers);
  }, []);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

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
      setRedoStack([]);
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
      setRedoStack([]);
      setLoading(false);
    } else {
      fetchPuzzle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
      setSavedIndicator(true);
      savedIndicatorRef.current = setTimeout(() => {
        setSavedIndicator(false);
        savedIndicatorRef.current = null;
      }, 2000);
      saveTimeoutRef.current = null;
    }, 400);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
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

  const conflictPositions = puzzle?.length ? getConflicts(board) : [];
  const isWon = useMemo(
    () =>
      puzzle?.length === 9 &&
      isBoardComplete(board) &&
      conflictPositions.length === 0,
    [puzzle?.length, board, conflictPositions.length]
  );

  const bestTimeSeconds = getBestTime(difficulty);
  const isNewBest = isWon && (bestTimeSeconds == null || timerSeconds < bestTimeSeconds);

  useEffect(() => {
    if (isWon && typeof window !== 'undefined') setBestTime(difficulty, timerSeconds);
  }, [isWon, difficulty, timerSeconds]);

  const maxMistakesReached = mistakes >= MAX_MISTAKES;

  const handleCellChange = useCallback(
    (row: number, col: number, value: CellValue) => {
      if (givenMask[row]?.[col]) return;
      if (maxMistakesReached && value !== 0) return;
      setRedoStack([]);
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
    [givenMask, solution, maxMistakesReached]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    setRedoStack((r) => [...r, copyBoard(board)]);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setBoard(copyBoard(prev));
  }, [undoStack, board]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    setUndoStack((u) => [...u, copyBoard(board)]);
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setBoard(copyBoard(next));
  }, [redoStack, board]);

  const handleErase = useCallback(() => {
    if (!selectedCell || givenMask[selectedCell.row]?.[selectedCell.col])
      return;
    setRedoStack([]);
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
    setRedoStack([]);
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
      if (!selectedCell || maxMistakesReached) return;
      handleCellChange(selectedCell.row, selectedCell.col, digit);
    },
    [selectedCell, handleCellChange, maxMistakesReached]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (loading || !puzzle?.length || isWon) return;
      const target = e.target as HTMLElement;
      if (target.closest('input') || target.closest('textarea')) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedCell((pos) =>
          pos ? { ...pos, col: Math.max(0, pos.col - 1) } : { row: 0, col: 0 }
        );
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedCell((pos) =>
          pos ? { ...pos, col: Math.min(8, pos.col + 1) } : { row: 0, col: 0 }
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCell((pos) =>
          pos ? { ...pos, row: Math.max(0, pos.row - 1) } : { row: 0, col: 0 }
        );
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCell((pos) =>
          pos ? { ...pos, row: Math.min(8, pos.row + 1) } : { row: 0, col: 0 }
        );
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const next = selectedCell
          ? findNextEmptyCell(board, selectedCell.row, selectedCell.col)
          : findFirstEmptyCell(board);
        if (next) setSelectedCell(next);
        return;
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [loading, puzzle?.length, isWon, selectedCell, board]);

  const conflictSet = useMemo(
    () => new Set(conflictPositions.map((p) => `${p.row},${p.col}`)),
    [conflictPositions]
  );

  const { completedRows, completedCols, completedBlocks } = useMemo(() => {
    const rows = new Set<number>();
    const cols = new Set<number>();
    const blocks = new Set<number>();
    if (!board?.length)
      return { completedRows: rows, completedCols: cols, completedBlocks: blocks };
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
        const bi = br * 3 + bc;
        let full = true;
        let noConflict = true;
        for (let r = br * 3; r < br * 3 + 3; r++) {
          for (let c = bc * 3; c < bc * 3 + 3; c++) {
            if (board[r][c] < 1 || board[r][c] > 9) full = false;
            if (conflictSet.has(`${r},${c}`)) noConflict = false;
          }
        }
        if (full && noConflict) blocks.add(bi);
      }
    }
    return { completedRows: rows, completedCols: cols, completedBlocks: blocks };
  }, [board, conflictSet]);

  if (loading && !puzzle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading puzzle…</p>
        </div>
      </div>
    );
  }

  if (error && !puzzle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 dark:bg-[var(--background)]">
        <p className="text-center text-slate-600 dark:text-slate-300">{error}</p>
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
    <div className="min-h-screen bg-slate-50 dark:bg-[var(--background)] dark:text-[var(--foreground)]">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              SudokuForge
            </h1>
            <nav className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    difficulty === d
                      ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {d}
                </button>
              ))}
            </nav>
            {bestTimeSeconds != null && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Best: {formatTime(bestTimeSeconds)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {savedIndicator && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <span aria-hidden>✓</span> Saved
              </span>
            )}
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              className="rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Mistakes
              </span>
              <span
                className={`tabular-nums font-semibold ${
                  mistakes >= MAX_MISTAKES
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {mistakes}/{MAX_MISTAKES}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">
              <span className="tabular-nums text-sm font-medium text-slate-700 dark:text-slate-300">
                {formatTime(timerSeconds)}
              </span>
              <button
                type="button"
                onClick={() => setTimerPaused((p) => !p)}
                className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                aria-label={timerPaused ? 'Resume' : 'Pause'}
              >
                <PauseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {maxMistakesReached && !isWon && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          Max mistakes reached. Undo a wrong cell or start a New game to continue.
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-slate-600 dark:text-slate-300">
            Fill each row, column, and 3×3 box with the digits 1–9, no repeats.
            Use arrow keys to move, Tab for next empty cell. Your progress is saved automatically.
          </p>
        </section>

        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-start lg:gap-12">
          <div className="flex flex-col items-start">
            <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
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
              {isWon && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/95 backdrop-blur dark:bg-slate-900/95"
                  role="dialog"
                  aria-labelledby="win-title"
                >
                  <h2 id="win-title" className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Puzzle solved!
                  </h2>
                  <p className="mt-2 text-slate-600 dark:text-slate-300">
                    Time: {formatTime(timerSeconds)}
                    {mistakes > 0 && ` · Mistakes: ${mistakes}`}
                  </p>
                  {isNewBest && (
                    <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      New best time for {difficulty}!
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={fetchPuzzle}
                    className="mt-6 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                  >
                    Play again
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-6 sm:w-52">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  aria-label="Undo"
                >
                  <UndoIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  aria-label="Redo"
                >
                  <RedoIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleErase}
                  disabled={
                    !selectedCell ||
                    givenMask[selectedCell?.row]?.[selectedCell?.col]
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                  aria-label="Erase"
                >
                  <EraseIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setNotesMode((n) => !n)}
                  className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    notesMode
                      ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600'
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
                    (selectedCell && board[selectedCell.row]?.[selectedCell.col] !== 0)
                  }
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
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
                    disabled={maxMistakesReached}
                    className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-100 text-lg font-semibold text-slate-800 transition-colors hover:bg-slate-200 active:scale-[0.98] disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
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
