import { NextRequest, NextResponse } from 'next/server';
import { initDb, getDb } from '@/lib/db';
import * as XLSX from 'xlsx';
import { getDomainStats } from '@/lib/report';
import { normalizeDomain } from '@/lib/crawler';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await initDb();
    const db = getDb();
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'xlsx';

    const project = await db.execute({ sql: `SELECT * FROM projects WHERE id = ?`, args: [id] });
    if (!project.rows.length) return NextResponse.json({ error: 'Projekt nie znaleziony' }, { status: 404 });

    const proj = project.rows[0];
    const domains: string[] = JSON.parse(proj.domains as string || '[]');

    const pages = await db.execute({ sql: `SELECT * FROM pages WHERE projectId = ?`, args: [id] });
    const recs = await db.execute({
      sql: `SELECT * FROM recommendations WHERE projectId = ? ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`,
      args: [id],
    });

    if (format === 'csv') {
      const headers = ['URL', 'Domena', 'Status', 'Title', 'Dl.Title', 'Meta Desc', 'H1', 'Slowa', 'Linki wewn.', 'Obrazy bez alt', 'Schema', 'CTA', 'Techniczny', 'On-Page', 'Tresc', 'Ogolny'];
      const csvRows = [headers.join(',')];
      for (const p of pages.rows) {
        const row = [
          `"${p.url}"`, p.domain, p.statusCode,
          `"${(p.title as string || '').replace(/"/g, '""')}"`, p.titleLength,
          `"${(p.metaDescription as string || '').replace(/"/g, '""').substring(0, 100)}"`,
          `"${(p.h1 as string || '').replace(/"/g, '""')}"`,
          p.wordCount, p.internalLinksCount, p.imagesNoAlt,
          p.hasJsonLd ? 'Tak' : 'Nie', p.hasCta ? 'Tak' : 'Nie',
          Math.round(p.technicalScore as number), Math.round(p.onPageScore as number),
          Math.round(p.contentScore as number), Math.round(p.overallScore as number),
        ];
        csvRows.push(row.join(','));
      }
      const bom = '\uFEFF';
      return new NextResponse(bom + csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="seo-report-${id}.csv"`,
        },
      });
    }

    // XLSX
    const wb = XLSX.utils.book_new();
    const domainStats = await Promise.all(domains.map(d => getDomainStats(id, normalizeDomain(d))));
    const overviewData = domainStats.map(s => ({
      'Domena': s.domain, 'Strony': s.totalPages, 'Indeksowalne': s.indexablePages,
      'Noindex': s.noindexPages, '404': s.errors404, 'Przekierowania': s.redirects,
      'Avg Slowa': s.avgWordCount, 'Brak Title %': s.missingTitlePct, 'Brak Meta %': s.missingMetaDescPct,
      'Brak H1 %': s.noH1Pct, 'Img bez Alt %': s.imagesNoAltPct, 'FAQ Schema': s.faqSchemaCount,
      'CTA': s.ctaCount, 'Tech Score': s.avgTechnicalScore, 'OnPage Score': s.avgOnPageScore,
      'Content Score': s.avgContentScore, 'Medical Score': s.avgMedicalTrustScore,
      'Conv. Score': s.avgConversionScore, 'Overall Score': s.overallScore,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overviewData), 'Overview');

    const pagesData = pages.rows.map(p => ({
      'URL': p.url, 'Domena': p.domain, 'Status': p.statusCode,
      'Title': p.title, 'Dl. Title': p.titleLength,
      'Meta Description': (p.metaDescription as string || '').substring(0, 160),
      'H1': p.h1, 'Liczba H1': p.h1Count, 'Slowa': p.wordCount,
      'Linki wewn.': p.internalLinksCount, 'Linki zewn.': p.externalLinksCount,
      'Obrazy': p.imagesCount, 'Obrazy bez alt': p.imagesNoAlt,
      'Indeksowalna': p.isIndexable ? 'Tak' : 'Nie', 'OG': p.hasOpenGraph ? 'Tak' : 'Nie',
      'JSON-LD': p.hasJsonLd ? 'Tak' : 'Nie', 'FAQ': p.hasFaqSchema ? 'Tak' : 'Nie',
      'CTA': p.hasCta ? 'Tak' : 'Nie', 'Formularz': p.hasForm ? 'Tak' : 'Nie',
      'Telefon': p.hasPhone ? 'Tak' : 'Nie', 'Autor': p.hasAuthor ? 'Tak' : 'Nie',
      'Disclaimer': p.hasMedicalDisclaimer ? 'Tak' : 'Nie',
      'Tech': Math.round(p.technicalScore as number), 'OnPage': Math.round(p.onPageScore as number),
      'Content': Math.round(p.contentScore as number), 'Schema': Math.round(p.schemaScore as number),
      'Medical': Math.round(p.medicalTrustScore as number), 'Conv.': Math.round(p.conversionScore as number),
      'Overall': Math.round(p.overallScore as number),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pagesData), 'Pages');

    const recsData = recs.rows.map(r => ({
      'Priorytet': r.priority, 'Kategoria': r.category, 'Tytul': r.title,
      'Opis': r.description, 'Dzialanie': r.action, 'Wplyw SEO': r.seoImpact,
      'Trudnosc': r.difficulty, 'URL': r.url, 'Domena': r.domain,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recsData), 'Recommendations');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="seo-report-${id}.xlsx"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Blad eksportu' }, { status: 500 });
  }
}
