import { NextRequest, NextResponse } from 'next/server';
import { initDb, cuid, getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await initDb();
    const db = getDb();
    const body = await req.json();
    const { name, domains, myDomain, maxPages, modules } = body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json({ error: 'Podaj co najmniej jedną domenę' }, { status: 400 });
    }

    const id = cuid();
    await db.execute({
      sql: `INSERT INTO projects (id, name, domains, myDomain, maxPages, modules, status) VALUES (?, ?, ?, ?, ?, ?, 'idle')`,
      args: [id, name || `Projekt ${new Date().toLocaleDateString('pl-PL')}`, JSON.stringify(domains), myDomain || null, maxPages || 50, JSON.stringify(modules || [])],
    });

    return NextResponse.json({ id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Błąd tworzenia projektu' }, { status: 500 });
  }
}

export async function GET() {
  try {
    await initDb();
    const db = getDb();
    const rows = await db.execute({ sql: `SELECT * FROM projects ORDER BY createdAt DESC`, args: [] });
    return NextResponse.json(rows.rows.map(r => ({
      ...r,
      domains: JSON.parse(r.domains as string || '[]'),
      modules: JSON.parse(r.modules as string || '[]'),
    })));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Błąd pobierania projektów' }, { status: 500 });
  }
}
