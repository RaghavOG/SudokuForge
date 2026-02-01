/**
 * SudokuForge – API route for puzzle generation.
 * Will return a new puzzle (board + solution) for the requested difficulty.
 */

import { NextResponse } from 'next/server';
// Generator will be implemented next; for now we return 501
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const difficulty = searchParams.get('difficulty') ?? 'medium';
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    return NextResponse.json(
      { error: 'Invalid difficulty. Use easy, medium, or hard.' },
      { status: 400 }
    );
  }
  // TODO: call generator and return { puzzle, solution }
  return NextResponse.json(
    { message: 'Puzzle generation not yet implemented', difficulty },
    { status: 501 }
  );
}
