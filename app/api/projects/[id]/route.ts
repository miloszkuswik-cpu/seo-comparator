import { NextRequest, NextResponse } from 'next/server';
import { initDb, getDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await initDb();
    const db = getDb();
    const row = await db.execute({ sql: `SELECT * FROM projects WHERE id = ?`, args: [id] });
    if (!row.rows.length) return NextResponse.json({ error: 'Projekt nie znaleziony' }, { status: 404 });
    const project = row.rows[0];
    return NextResponse.json({
      ...project,
      domains: JSON.parse(project.domains as string || '[]'),
      modules: JSON.parse(project.modules as string || '[]'),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Błąd' }, { status: 500 });
  }
}
