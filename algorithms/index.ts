/**
 * SudokuForge – Algorithm layer (pure TypeScript, no framework imports).
 */

export {
  type Board,
  type CellValue,
  type MutableBoard,
  type Position,
  type Difficulty,
  type GameState,
  BLOCK_SIZE,
  GRID_SIZE,
  createEmptyBoard,
  cloneBoard,
  freezeBoard,
} from './types';

export {
  solve,
  isValidPlacement,
  isBoardComplete,
  countSolutions,
  hasUniqueSolution,
} from './solver';

export {
  isValidBoardShape,
  getConflicts,
  isValidPartialBoard,
} from './validation';

export { generatePuzzle, type GeneratedPuzzle } from './generator';
