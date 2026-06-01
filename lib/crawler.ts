import { analyzeHtml, scorePage, extractLinksFromHtml, PageAnalysis } from './analyzer';
import { getDb, cuid, initDb } from './db';

const USER_AGENT = 'SEOComparatorBot/1.0';
const REQUEST_TIMEOUT = 10000;
const MAX_HTML_SIZE = 2 * 1024 * 1024; // 2MB
const SKIP_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|svg|pdf|zip|css|js|xml|mp4|mov|avi|ico|woff|woff2|ttf|eot)(\?.*)?$/i;

export interface CrawlProgress {
  domain: string;
  status: string;
  pagesFound: number;
  pagesAnalyzed: number;
}

async function fetchWithTimeout(url: string, timeout = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow',
    });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRobotsTxt(domain: string): Promise<string | null> {
  try {
    const resp = await fetchWithTimeout(`https://${domain}/robots.txt`);
    if (resp.ok) return await resp.text();
    return null;
  } catch { return null; }
}

function isAllowedByRobots(robotsTxt: string | null, url: string): boolean {
  if (!robotsTxt) return true;
  const lines = robotsTxt.split('\n');
  let inOurSection = false;
  const disallowed: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith('user-agent:')) {
      const agent = trimmed.split(':')[1].trim();
      inOurSection = agent === '*' || agent.toLowerCase().includes('seocomparator');
    } else if (inOurSection && trimmed.toLowerCase().startsWith('disallow:')) {
      const path = trimmed.split(':')[1]?.trim();
      if (path) disallowed.push(path);
    }
  }

  try {
    const urlPath = new URL(url).pathname;
    return !disallowed.some(d => d !== '' && urlPath.startsWith(d));
  } catch { return true; }
}

async function fetchSitemapUrls(domain: string): Promise<string[]> {
  const urls: string[] = [];
  const sitemapUrls = [`https://${domain}/sitemap.xml`, `https://${domain}/sitemap_index.xml`];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const resp = await fetchWithTimeout(sitemapUrl);
      if (!resp.ok) continue;
      const xml = await resp.text();

      // Check if it's a sitemap index
      if (xml.includes('<sitemapindex')) {
        const subSitemaps = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].trim());
        for (const sub of subSitemaps.slice(0, 5)) {
          try {
            const subResp = await fetchWithTimeout(sub);
            if (subResp.ok) {
              const subXml = await subResp.text();
              const subUrls = [...subXml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].trim());
              urls.push(...subUrls);
            }
          } catch { /* skip */ }
        }
      } else {
        const pageUrls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].trim());
        urls.push(...pageUrls);
      }

      if (urls.length > 0) break;
    } catch { /* skip */ }
  }

  return urls;
}

async function crawlPage(url: string): Promise<{
  finalUrl: string;
  statusCode: number;
  isRedirect: boolean;
  contentType: string;
  html: string | null;
  fetchTimeMs: number;
  error: string | null;
}> {
  const start = Date.now();

  try {
    const resp = await fetchWithTimeout(url);
    const fetchTimeMs = Date.now() - start;
    const finalUrl = resp.url || url;
    const isRedirect = finalUrl !== url;
    const contentType = resp.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return { finalUrl, statusCode: resp.status, isRedirect, contentType, html: null, fetchTimeMs, error: 'Not HTML' };
    }

    // Check content-length
    const contentLength = parseInt(resp.headers.get('content-length') || '0');
    if (contentLength > MAX_HTML_SIZE) {
      return { finalUrl, statusCode: resp.status, isRedirect, contentType, html: null, fetchTimeMs, error: 'Too large' };
    }

    let html = await resp.text();
    if (html.length > MAX_HTML_SIZE) html = html.substring(0, MAX_HTML_SIZE);

    return { finalUrl, statusCode: resp.status, isRedirect, contentType, html, fetchTimeMs, error: null };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    return { finalUrl: url, statusCode: 0, isRedirect: false, contentType: '', html: null, fetchTimeMs: Date.now() - start, error };
  }
}

export async function crawlDomain(
  projectId: string,
  crawlRunId: string,
  domain: string,
  maxPages: number,
  onProgress?: (progress: CrawlProgress) => void
): Promise<void> {
  const db = getDb();

  const updateRun = async (status: string, extra?: Partial<{ pagesFound: number; pagesAnalyzed: number; error: string }>) => {
    const fields = ['status = ?'];
    const values: (string | number)[] = [status];
    if (extra?.pagesFound !== undefined) { fields.push('pagesFound = ?'); values.push(extra.pagesFound); }
    if (extra?.pagesAnalyzed !== undefined) { fields.push('pagesAnalyzed = ?'); values.push(extra.pagesAnalyzed); }
    if (extra?.error !== undefined) { fields.push('error = ?'); values.push(extra.error); }
    values.push(crawlRunId);
    await db.execute({ sql: `UPDATE crawl_runs SET ${fields.join(', ')} WHERE id = ?`, args: values });
  };

  try {
    await updateRun('fetching_sitemap');
    onProgress?.({ domain, status: 'fetching_sitemap', pagesFound: 0, pagesAnalyzed: 0 });

    const robotsTxt = await fetchRobotsTxt(domain);
    let urlsToVisit: string[] = [];

    // Try sitemap
    const sitemapUrls = await fetchSitemapUrls(domain);
    if (sitemapUrls.length > 0) {
      urlsToVisit = sitemapUrls.filter(u => {
        try { return new URL(u).hostname.includes(domain.replace('www.', '')); }
        catch { return false; }
      });
    }

    // Fallback to crawling
    if (urlsToVisit.length === 0) {
      urlsToVisit = [`https://${domain}/`];
    }

    // Limit pages
    urlsToVisit = urlsToVisit.slice(0, maxPages);
    await updateRun('crawling', { pagesFound: urlsToVisit.length });
    onProgress?.({ domain, status: 'crawling', pagesFound: urlsToVisit.length, pagesAnalyzed: 0 });

    // If crawling from homepage, BFS
    if (urlsToVisit.length <= 1 && sitemapUrls.length === 0) {
      const visited = new Set<string>();
      const queue = [...urlsToVisit];
      urlsToVisit = [];

      while (queue.length > 0 && urlsToVisit.length < maxPages) {
        const url = queue.shift()!;
        if (visited.has(url)) continue;
        visited.add(url);
        urlsToVisit.push(url);

        if (!isAllowedByRobots(robotsTxt, url)) continue;

        const result = await crawlPage(url);
        if (result.html) {
          const newLinks = extractLinksFromHtml(result.html, url, domain);
          for (const link of newLinks) {
            if (!visited.has(link) && urlsToVisit.length + queue.length < maxPages) {
              queue.push(link);
            }
          }
        }

        await new Promise(r => setTimeout(r, 200)); // polite delay
      }
    }

    await updateRun('analyzing', { pagesFound: urlsToVisit.length });

    let analyzed = 0;
    const CONCURRENCY = 5;

    // Process in batches
    for (let i = 0; i < urlsToVisit.length; i += CONCURRENCY) {
      const batch = urlsToVisit.slice(i, i + CONCURRENCY);

      await Promise.all(batch.map(async (url) => {
        if (SKIP_EXTENSIONS.test(url)) return;
        if (!isAllowedByRobots(robotsTxt, url)) return;

        const result = await crawlPage(url);
        const pageId = cuid();

        let analysis: PageAnalysis | null = null;
        let scores = { technicalScore: 0, onPageScore: 0, contentScore: 0, internalLinksScore: 0, imageScore: 0, schemaScore: 0, medicalTrustScore: 0, localSeoScore: 0, conversionScore: 0, overallScore: 0 };

        if (result.html) {
          analysis = analyzeHtml(result.html, result.finalUrl || url, domain);
          scores = scorePage(analysis);
        }

        await db.execute({
          sql: `INSERT INTO pages (
            id, crawlRunId, projectId, domain, url, finalUrl, statusCode, isRedirect, contentType, fetchTimeMs, error,
            title, titleLength, metaDescription, metaDescLength, canonical, metaRobots, isIndexable,
            h1, h1Count, h2List, h3List, wordCount, bodyText,
            internalLinksCount, externalLinksCount, internalLinks, externalLinks,
            imagesCount, imagesNoAlt, imageAlts,
            hasOpenGraph, hasTwitterCards, hasJsonLd, schemaTypes,
            hasFaqSchema, hasArticleSchema, hasMedicalWebPage, hasLocalBusiness, hasPhysician, hasMedicalClinic,
            hasCta, hasForm, hasPhone, hasEmail, hasBookingLink, detectedWidgets,
            hasAuthor, authorBio, publishDate, updateDate, hasExternalSources, hasMedicalDisclaimer,
            hasCompanyInfo, hasTerms, hasPrivacyPolicy, hasContact,
            technicalScore, onPageScore, contentScore, internalLinksScore, imageScore, schemaScore,
            medicalTrustScore, localSeoScore, conversionScore, overallScore
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?
          )`,
          args: [
            pageId, crawlRunId, projectId, domain, url, result.finalUrl || url, result.statusCode, result.isRedirect ? 1 : 0,
            result.contentType, result.fetchTimeMs, result.error,
            analysis?.title ?? null, analysis?.titleLength ?? 0, analysis?.metaDescription ?? null, analysis?.metaDescLength ?? 0,
            analysis?.canonical ?? null, analysis?.metaRobots ?? null, analysis?.isIndexable ? 1 : 0,
            analysis?.h1 ?? null, analysis?.h1Count ?? 0,
            JSON.stringify(analysis?.h2List ?? []), JSON.stringify(analysis?.h3List ?? []),
            analysis?.wordCount ?? 0, analysis?.bodyText ?? null,
            analysis?.internalLinksCount ?? 0, analysis?.externalLinksCount ?? 0,
            JSON.stringify(analysis?.internalLinks ?? []), JSON.stringify(analysis?.externalLinks ?? []),
            analysis?.imagesCount ?? 0, analysis?.imagesNoAlt ?? 0, JSON.stringify(analysis?.imageAlts ?? []),
            analysis?.hasOpenGraph ? 1 : 0, analysis?.hasTwitterCards ? 1 : 0, analysis?.hasJsonLd ? 1 : 0,
            JSON.stringify(analysis?.schemaTypes ?? []),
            analysis?.hasFaqSchema ? 1 : 0, analysis?.hasArticleSchema ? 1 : 0, analysis?.hasMedicalWebPage ? 1 : 0,
            analysis?.hasLocalBusiness ? 1 : 0, analysis?.hasPhysician ? 1 : 0, analysis?.hasMedicalClinic ? 1 : 0,
            analysis?.hasCta ? 1 : 0, analysis?.hasForm ? 1 : 0, analysis?.hasPhone ? 1 : 0, analysis?.hasEmail ? 1 : 0,
            analysis?.hasBookingLink ? 1 : 0, JSON.stringify(analysis?.detectedWidgets ?? []),
            analysis?.hasAuthor ? 1 : 0, analysis?.authorBio ? 1 : 0, analysis?.publishDate ?? null, analysis?.updateDate ?? null,
            analysis?.hasExternalSources ? 1 : 0, analysis?.hasMedicalDisclaimer ? 1 : 0,
            analysis?.hasCompanyInfo ? 1 : 0, analysis?.hasTerms ? 1 : 0, analysis?.hasPrivacyPolicy ? 1 : 0, analysis?.hasContact ? 1 : 0,
            scores.technicalScore, scores.onPageScore, scores.contentScore, scores.internalLinksScore, scores.imageScore,
            scores.schemaScore, scores.medicalTrustScore, scores.localSeoScore, scores.conversionScore, scores.overallScore,
          ],
        });

        analyzed++;
        await updateRun('analyzing', { pagesAnalyzed: analyzed });
        onProgress?.({ domain, status: 'analyzing', pagesFound: urlsToVisit.length, pagesAnalyzed: analyzed });
      }));
    }

    await updateRun('done', { pagesAnalyzed: analyzed });
    onProgress?.({ domain, status: 'done', pagesFound: urlsToVisit.length, pagesAnalyzed: analyzed });

  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    await updateRun('error', { error });
    onProgress?.({ domain, status: 'error', pagesFound: 0, pagesAnalyzed: 0 });
  }
}

export function normalizeDomain(input: string): string {
  let url = input.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return input.trim().replace(/^www\./, '').split('/')[0];
  }
}
