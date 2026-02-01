/**
 * SudokuForge – API route for puzzle generation.
 * Returns a new puzzle and its solution for the requested difficulty.
 */

import { NextResponse } from 'next/server';
import { generatePuzzle } from '@/algorithms';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const difficultyParam = searchParams.get('difficulty') ?? 'medium';
  if (!['easy', 'medium', 'hard'].includes(difficultyParam)) {
    return NextResponse.json(
      { error: 'Invalid difficulty. Use easy, medium, or hard.' },
      { status: 400 }
    );
  }
  const difficulty = difficultyParam as 'easy' | 'medium' | 'hard';
  const { puzzle, solution } = generatePuzzle(difficulty);
  return NextResponse.json({ puzzle, solution });
}
