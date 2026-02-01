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

export function saveGame(state: Omit<PersistedState, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const data: PersistedState = { ...state, savedAt: Date.now() };
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
