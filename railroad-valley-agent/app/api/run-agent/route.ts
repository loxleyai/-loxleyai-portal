import { NextResponse } from 'next/server';
import { runAgent } from '@/agents/orchestrator';

export async function GET() {
  const results = runAgent();
  return NextResponse.json(results);
}
