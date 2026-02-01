/**
 * Persist game state to localStorage. Restore on load; clear on New game.
 */

const STORAGE_KEY = 'sudokuforge-game';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PersistedState {
  puzzle: number[][];
  solution: number[][];
  givenMask: boolean[][];
  board: number[][];
  difficulty: string;
  timerSeconds: number;
  timerPaused: boolean;
  mistakes: number;
  hintsLeft: number;
  selectedCell: { row: number; col: number } | null;
  savedAt: number;
}

/** Input for saveGame accepts readonly arrays (e.g. Board from algorithms). */
export interface SaveGameState {
  puzzle: readonly (readonly number[])[];
  solution: readonly (readonly number[])[];
  givenMask: readonly (readonly boolean[])[];
  board: readonly (readonly number[])[];
  difficulty: string;
  timerSeconds: number;
  timerPaused: boolean;
  mistakes: number;
  hintsLeft: number;
  selectedCell: { row: number; col: number } | null;
}

export function saveGame(state: SaveGameState): void {
  if (typeof window === 'undefined') return;
  try {
    const data: PersistedState = {
      ...state,
      puzzle: state.puzzle.map((r) => [...r]),
      solution: state.solution.map((r) => [...r]),
      givenMask: state.givenMask.map((r) => [...r]),
      board: state.board.map((r) => [...r]),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota / private mode
  }
}

export function loadGame(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedState;
    if (
      !data.puzzle?.length ||
      !data.board?.length ||
      !data.solution?.length ||
      data.board.length !== 9 ||
      data.puzzle.length !== 9 ||
      data.solution.length !== 9
    )
      return null;
    if (Date.now() - (data.savedAt ?? 0) > MAX_AGE_MS) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const BEST_TIME_KEY_PREFIX = 'sudokuforge-best-';

export function getBestTime(difficulty: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BEST_TIME_KEY_PREFIX + difficulty);
    if (raw == null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setBestTime(difficulty: string, seconds: number): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getBestTime(difficulty);
    if (current != null && seconds >= current) return;
    window.localStorage.setItem(BEST_TIME_KEY_PREFIX + difficulty, String(seconds));
  } catch {
    // ignore
  }
}
