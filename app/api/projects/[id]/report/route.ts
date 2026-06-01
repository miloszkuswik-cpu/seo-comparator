import { NextRequest, NextResponse } from 'next/server';
import { initDb, getDb } from '@/lib/db';
import { getDomainStats, analyzeContentGap, detectDuplicates } from '@/lib/report';
import { normalizeDomain } from '@/lib/crawler';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await initDb();
    const db = getDb();

    const project = await db.execute({ sql: `SELECT * FROM projects WHERE id = ?`, args: [id] });
    if (!project.rows.length) return NextResponse.json({ error: 'Projekt nie znaleziony' }, { status: 404 });

    const proj = project.rows[0];
    const domains: string[] = JSON.parse(proj.domains as string || '[]');

    const domainStats = await Promise.all(domains.map(d => getDomainStats(id, normalizeDomain(d))));

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = 50;
    const domainFilter = url.searchParams.get('domain') || '';
    const search = url.searchParams.get('search') || '';

    let whereClauses = ['projectId = ?'];
    const whereArgs: (string | number)[] = [id];
    if (domainFilter) { whereClauses.push('domain = ?'); whereArgs.push(domainFilter); }
    if (search) { whereClauses.push('url LIKE ?'); whereArgs.push(`%${search}%`); }
    const whereStr = whereClauses.join(' AND ');

    const countRow = await db.execute({ sql: `SELECT COUNT(*) as cnt FROM pages WHERE ${whereStr}`, args: whereArgs });
    const totalPages = Number(countRow.rows[0]?.cnt || 0);

    const pagesResult = await db.execute({
      sql: `SELECT id, domain, url, statusCode, title, titleLength, metaDescription, h1, h1Count, wordCount, internalLinksCount, externalLinksCount, imagesCount, imagesNoAlt, isIndexable, hasOpenGraph, hasJsonLd, hasCta, hasForm, hasPhone, hasAuthor, hasMedicalDisclaimer, hasMedicalWebPage, hasPhysician, hasMedicalClinic, hasLocalBusiness, technicalScore, onPageScore, contentScore, overallScore, schemaScore, medicalTrustScore, localSeoScore, conversionScore FROM pages WHERE ${whereStr} ORDER BY overallScore ASC LIMIT ? OFFSET ?`,
      args: [...whereArgs, pageSize, (page - 1) * pageSize],
    });

    const myDomain = proj.myDomain ? normalizeDomain(proj.myDomain as string) : null;
    let contentGap: any[] = [];
    if (myDomain) contentGap = await analyzeContentGap(id, myDomain);

    const duplicates = await detectDuplicates(id);

    const recs = await db.execute({
      sql: `SELECT * FROM recommendations WHERE projectId = ? ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 500`,
      args: [id],
    });

    const linkData = await db.execute({
      sql: `SELECT url, internalLinks FROM pages WHERE projectId = ? AND internalLinks IS NOT NULL`,
      args: [id],
    });

    const incomingLinks: Record<string, number> = {};
    for (const p of linkData.rows) {
      try {
        const links = JSON.parse(p.internalLinks as string || '[]') as { url: string; anchor: string }[];
        for (const l of links) incomingLinks[l.url] = (incomingLinks[l.url] || 0) + 1;
      } catch {}
    }

    const orphanPages = pagesResult.rows.filter(p => !incomingLinks[p.url as string]).map(p => p.url as string);

    return NextResponse.json({
      project: { ...proj, domains, modules: JSON.parse(proj.modules as string || '[]') },
      domainStats, pages: pagesResult.rows, totalPages,
      contentGap, duplicates, recommendations: recs.rows,
      internalLinksMap: { incomingLinks, orphanPages },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Błąd generowania raportu' }, { status: 500 });
  }
}
