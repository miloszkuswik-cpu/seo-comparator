import { NextRequest, NextResponse } from 'next/server';
import { initDb, getDb, cuid } from '@/lib/db';
import { crawlDomain, normalizeDomain } from '@/lib/crawler';
import { generateRecommendations } from '@/lib/report';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await initDb();
    const db = getDb();

    const project = await db.execute({ sql: `SELECT * FROM projects WHERE id = ?`, args: [id] });
    if (!project.rows.length) return NextResponse.json({ error: 'Projekt nie znaleziony' }, { status: 404 });

    const proj = project.rows[0];
    if (proj.status === 'running') return NextResponse.json({ error: 'Analiza już trwa' }, { status: 400 });

    const domains: string[] = JSON.parse(proj.domains as string || '[]');
    const maxPages = (proj.maxPages as number) || 50;

    await db.execute({ sql: `UPDATE projects SET status = 'running', updatedAt = datetime('now') WHERE id = ?`, args: [id] });

    (async () => {
      try {
        for (const rawDomain of domains) {
          const domain = normalizeDomain(rawDomain);
          const runId = cuid();
          await db.execute({
            sql: `INSERT INTO crawl_runs (id, projectId, domain, status, startedAt) VALUES (?, ?, ?, 'pending', datetime('now'))`,
            args: [runId, id, domain],
          });
          await crawlDomain(id, runId, domain, maxPages);
        }
        await generateRecommendations(id);
        await db.execute({ sql: `UPDATE projects SET status = 'done', updatedAt = datetime('now') WHERE id = ?`, args: [id] });
      } catch (e) {
        console.error('Crawl error:', e);
        await db.execute({ sql: `UPDATE projects SET status = 'error', updatedAt = datetime('now') WHERE id = ?`, args: [id] });
      }
    })();

    return NextResponse.json({ ok: true, message: 'Analiza uruchomiona' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Błąd uruchamiania analizy' }, { status: 500 });
  }
}
