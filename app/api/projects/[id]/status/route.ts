import { NextRequest, NextResponse } from 'next/server';
import { initDb, getDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await initDb();
    const db = getDb();
    const project = await db.execute({ sql: `SELECT status FROM projects WHERE id = ?`, args: [id] });
    if (!project.rows.length) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });
    const runs = await db.execute({
      sql: `SELECT domain, status, pagesFound, pagesAnalyzed, error FROM crawl_runs WHERE projectId = ?`,
      args: [id],
    });
    return NextResponse.json({ status: project.rows[0].status, runs: runs.rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Błąd' }, { status: 500 });
  }
}
