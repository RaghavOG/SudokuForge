'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SudokuGrid } from '@/components/SudokuGrid';
import {
  UndoIcon,
  EraseIcon,
  PencilIcon,
  HintIcon,
  PauseIcon,
} from '@/components/GameIcons';
import { getConflicts } from '@/algorithms';
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

  const fetchPuzzle = useCallback(async () => {
    setLoading(true);
    setError(null);
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

  useEffect(() => {
    fetchPuzzle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer
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

  if (loading && !puzzle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0f4f8]">
        <p className="text-zinc-600">Loading puzzle…</p>
      </div>
    );
  }

  if (error && !puzzle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f0f4f8]">
        <p className="text-red-600">{error}</p>
        <button
          type="button"
          onClick={fetchPuzzle}
          className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!puzzle?.length) return null;

  return (
    <div className="min-h-screen bg-[#f0f4f8] text-zinc-800">
      {/* Top bar */}
      <header className="grid grid-cols-3 items-center border-b border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="mr-2 text-sm text-zinc-500">Difficulty:</span>
          {(['easy', 'medium', 'hard'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={`px-2 py-1 text-sm font-medium capitalize ${
                difficulty === d
                  ? 'text-blue-600 underline'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="text-center text-3xl font-bold text-zinc-400">0</div>
        <div className="flex items-center justify-end gap-4">
          <span className="text-sm text-zinc-600">
            Mistakes {mistakes}/{MAX_MISTAKES}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-sm tabular-nums text-zinc-600">
              Time {formatTime(timerSeconds)}
            </span>
            <button
              type="button"
              onClick={() => setTimerPaused((p) => !p)}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label={timerPaused ? 'Resume' : 'Pause'}
            >
              <PauseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col items-start gap-6 p-6 sm:flex-row">
        {/* Left: grid + banner */}
        <div className="flex flex-col items-start gap-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow">
            <SudokuGrid
              board={board}
              givenMask={givenMask}
              solution={solution}
              selectedCell={selectedCell}
              conflictPositions={conflictPositions}
              onSelectCell={setSelectedCell}
              onCellChange={handleCellChange}
            />
          </div>
          <div className="w-full max-w-[calc(2.25rem*9+2rem)] rounded-xl bg-blue-800 px-4 py-3 text-center text-white">
            <span className="text-sm">
              Only <strong className="text-amber-400">59%</strong> of players
              were able to solve this puzzle!
            </span>
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex w-full flex-col items-center gap-6 sm:w-56">
          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-40"
              aria-label="Undo"
            >
              <UndoIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={handleErase}
              disabled={
                !selectedCell ||
                givenMask[selectedCell?.row]?.[selectedCell?.col]
              }
              className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-40"
              aria-label="Erase"
            >
              <EraseIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => setNotesMode((n) => !n)}
              className="relative flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200"
              aria-label="Notes"
            >
              <PencilIcon className="h-6 w-6" />
              <span className="absolute -top-1 right-0 text-[10px] font-medium text-zinc-500">
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
              className="relative flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-40"
              aria-label="Hint"
            >
              <HintIcon className="h-6 w-6" />
              {hintsLeft > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {hintsLeft}
                </span>
              )}
            </button>
          </div>

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleNumberPad(n)}
                className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-200 text-lg font-semibold text-blue-800 hover:bg-zinc-300"
              >
                {n}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchPuzzle}
            disabled={loading}
            className="w-full rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'New Game'}
          </button>
        </div>
      </main>
    </div>
  );
}
