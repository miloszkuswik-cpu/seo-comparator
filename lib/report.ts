import { getDb } from './db';

export interface DomainStats {
  domain: string;
  totalPages: number;
  indexablePages: number;
  noindexPages: number;
  errors404: number;
  errors500: number;
  redirects: number;
  avgTitleLength: number;
  missingTitlePct: number;
  duplicateTitlePct: number;
  missingMetaDescPct: number;
  duplicateMetaDescPct: number;
  noH1Pct: number;
  multipleH1Pct: number;
  avgWordCount: number;
  avgInternalLinks: number;
  avgExternalLinks: number;
  imagesNoAltPct: number;
  faqSchemaCount: number;
  articleSchemaCount: number;
  medicalWebPageCount: number;
  localBusinessCount: number;
  ctaCount: number;
  avgTechnicalScore: number;
  avgOnPageScore: number;
  avgContentScore: number;
  avgInternalLinksScore: number;
  avgMedicalTrustScore: number;
  avgConversionScore: number;
  overallScore: number;
}

export async function getDomainStats(projectId: string, domain: string): Promise<DomainStats> {
  const db = getDb();
  const rows = await db.execute({
    sql: `SELECT * FROM pages WHERE projectId = ? AND domain = ?`,
    args: [projectId, domain],
  });

  const pages = rows.rows;
  if (pages.length === 0) {
    return {
      domain, totalPages: 0, indexablePages: 0, noindexPages: 0,
      errors404: 0, errors500: 0, redirects: 0,
      avgTitleLength: 0, missingTitlePct: 0, duplicateTitlePct: 0,
      missingMetaDescPct: 0, duplicateMetaDescPct: 0,
      noH1Pct: 0, multipleH1Pct: 0, avgWordCount: 0,
      avgInternalLinks: 0, avgExternalLinks: 0, imagesNoAltPct: 0,
      faqSchemaCount: 0, articleSchemaCount: 0, medicalWebPageCount: 0,
      localBusinessCount: 0, ctaCount: 0,
      avgTechnicalScore: 0, avgOnPageScore: 0, avgContentScore: 0,
      avgInternalLinksScore: 0, avgMedicalTrustScore: 0, avgConversionScore: 0,
      overallScore: 0,
    };
  }

  const total = pages.length;
  const indexable = pages.filter(p => Number(p.isIndexable) === 1).length;
  const noindex = total - indexable;
  const errors404 = pages.filter(p => Number(p.statusCode) === 404).length;
  const errors500 = pages.filter(p => Number(p.statusCode) >= 500).length;
  const redirects = pages.filter(p => Number(p.isRedirect) === 1).length;

  const titles = pages.map(p => p.title as string | null);
  const missingTitle = titles.filter(t => !t).length;
  const titleCounts: Record<string, number> = {};
  titles.filter(Boolean).forEach(t => { titleCounts[t!] = (titleCounts[t!] || 0) + 1; });
  const duplicateTitles = Object.values(titleCounts).filter(c => c > 1).reduce((a, b) => a + b, 0);

  const descs = pages.map(p => p.metaDescription as string | null);
  const missingDesc = descs.filter(d => !d).length;
  const descCounts: Record<string, number> = {};
  descs.filter(Boolean).forEach(d => { descCounts[d!] = (descCounts[d!] || 0) + 1; });
  const duplicateDescs = Object.values(descCounts).filter(c => c > 1).reduce((a, b) => a + b, 0);

  const noH1 = pages.filter(p => !p.h1Count || p.h1Count === 0).length;
  const multiH1 = pages.filter(p => (p.h1Count as number) > 1).length;

  const avg = (field: string) => pages.reduce((s, p) => s + ((p[field] as number) || 0), 0) / total;

  const totalImages = pages.reduce((s, p) => s + ((p.imagesCount as number) || 0), 0);
  const totalImagesNoAlt = pages.reduce((s, p) => s + ((p.imagesNoAlt as number) || 0), 0);
  const imagesNoAltPct = totalImages > 0 ? (totalImagesNoAlt / totalImages) * 100 : 0;

  const scores = [
    avg('technicalScore'), avg('onPageScore'), avg('contentScore'),
    avg('internalLinksScore'), avg('medicalTrustScore'), avg('conversionScore'),
  ];

  return {
    domain,
    totalPages: total,
    indexablePages: indexable,
    noindexPages: noindex,
    errors404, errors500, redirects,
    avgTitleLength: Math.round(avg('titleLength')),
    missingTitlePct: Math.round((missingTitle / total) * 100),
    duplicateTitlePct: Math.round((duplicateTitles / total) * 100),
    missingMetaDescPct: Math.round((missingDesc / total) * 100),
    duplicateMetaDescPct: Math.round((duplicateDescs / total) * 100),
    noH1Pct: Math.round((noH1 / total) * 100),
    multipleH1Pct: Math.round((multiH1 / total) * 100),
    avgWordCount: Math.round(avg('wordCount')),
    avgInternalLinks: Math.round(avg('internalLinksCount') * 10) / 10,
    avgExternalLinks: Math.round(avg('externalLinksCount') * 10) / 10,
    imagesNoAltPct: Math.round(imagesNoAltPct),
    faqSchemaCount: pages.filter(p => Number(p.hasFaqSchema) === 1).length,
    articleSchemaCount: pages.filter(p => Number(p.hasArticleSchema) === 1).length,
    medicalWebPageCount: pages.filter(p => Number(p.hasMedicalWebPage) === 1).length,
    localBusinessCount: pages.filter(p => Number(p.hasLocalBusiness) === 1).length,
    ctaCount: pages.filter(p => Number(p.hasCta) === 1).length,
    avgTechnicalScore: Math.round(scores[0]),
    avgOnPageScore: Math.round(scores[1]),
    avgContentScore: Math.round(scores[2]),
    avgInternalLinksScore: Math.round(scores[3]),
    avgMedicalTrustScore: Math.round(scores[4]),
    avgConversionScore: Math.round(scores[5]),
    overallScore: Math.round(scores.reduce((a, b) => a + b) / scores.length),
  };
}

export interface ContentGapTopic {
  topic: string;
  competitorDomains: string[];
  exampleUrls: string[];
  priority: 'high' | 'medium' | 'low';
  contentType: string;
  suggestedTitle: string;
  suggestedH1: string;
  suggestedH2s: string[];
  suggestedInternalLinks: string[];
  recommendation: string;
}

const PL_STOP_WORDS = new Set([
  'i', 'w', 'z', 'na', 'do', 'się', 'że', 'nie', 'to', 'jest', 'jak', 'co', 'czy',
  'po', 'przez', 'ale', 'już', 'tego', 'tej', 'dla', 'przy', 'tak', 'być', 'o',
  'ze', 'ten', 'ta', 'te', 'który', 'która', 'które', 'jego', 'jej', 'ich',
]);
const EN_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'this', 'that', 'these', 'those', 'it', 'its',
]);

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-ząćęłńóśźżа-я\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTokens(text: string): string[] {
  return normalizeText(text).split(' ')
    .filter(t => t.length > 3 && !PL_STOP_WORDS.has(t) && !EN_STOP_WORDS.has(t));
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export async function analyzeContentGap(projectId: string, myDomain: string): Promise<ContentGapTopic[]> {
  const db = getDb();

  // Get all pages grouped by domain
  const allPages = await db.execute({
    sql: `SELECT domain, url, title, h1, h2List FROM pages WHERE projectId = ? AND isIndexable = 1`,
    args: [projectId],
  });

  const myPages = allPages.rows.filter(p => p.domain === myDomain);
  const competitorPages = allPages.rows.filter(p => p.domain !== myDomain);

  // Extract topics from each domain
  function extractTopics(pages: typeof allPages.rows): Map<string, { domain: string; url: string; tokens: string[] }[]> {
    const topics = new Map<string, { domain: string; url: string; tokens: string[] }[]>();

    for (const page of pages) {
      const texts = [
        page.title as string || '',
        page.h1 as string || '',
        ...(JSON.parse(page.h2List as string || '[]') as string[]),
      ].filter(Boolean);

      for (const text of texts) {
        const tokens = extractTokens(text);
        if (tokens.length < 2) continue;

        const topicKey = tokens.slice(0, 3).sort().join('_');
        if (!topics.has(topicKey)) topics.set(topicKey, []);
        topics.get(topicKey)!.push({ domain: page.domain as string, url: page.url as string, tokens });
      }
    }
    return topics;
  }

  const myTopics = extractTopics(myPages);
  const competitorTopics = extractTopics(competitorPages);

  const gaps: ContentGapTopic[] = [];

  for (const [topicKey, competitorEntries] of competitorTopics) {
    // Check if this topic exists in my domain
    let foundInMine = false;
    const competitorTokensAll = competitorEntries.flatMap(e => e.tokens);

    for (const [, myEntries] of myTopics) {
      const myTokens = myEntries.flatMap(e => e.tokens);
      if (jaccardSimilarity(competitorTokensAll, myTokens) > 0.3) {
        foundInMine = true;
        break;
      }
    }

    if (!foundInMine && competitorEntries.length > 0) {
      const uniqueDomains = [...new Set(competitorEntries.map(e => e.domain))];
      const topicText = competitorEntries[0].tokens.slice(0, 4).join(' ');
      const priority: 'high' | 'medium' | 'low' = uniqueDomains.length >= 2 ? 'high' : competitorEntries.length > 3 ? 'medium' : 'low';

      // Determine content type
      const hasLocalWord = /miasto|lokalne|warszawa|kraków|łódź/i.test(topicText);
      const hasFaqWord = /jak|czy|kiedy|dlaczego|co to/i.test(topicText);
      const contentType = hasLocalWord ? 'strona lokalna' : hasFaqWord ? 'FAQ' : competitorEntries.length > 5 ? 'artykuł' : 'landing';

      const titleWords = competitorEntries[0].tokens.slice(0, 5).join(' ');

      gaps.push({
        topic: topicText,
        competitorDomains: uniqueDomains,
        exampleUrls: competitorEntries.slice(0, 3).map(e => e.url),
        priority,
        contentType,
        suggestedTitle: `${titleWords.charAt(0).toUpperCase() + titleWords.slice(1)} - kompleksowy przewodnik`,
        suggestedH1: `${titleWords.charAt(0).toUpperCase() + titleWords.slice(1)}`,
        suggestedH2s: [
          `Co to jest ${topicText}?`,
          `Jak działa ${topicText}?`,
          `Kiedy warto wybrać ${topicText}?`,
          `Najczęściej zadawane pytania`,
        ],
        suggestedInternalLinks: myPages.slice(0, 3).map(p => p.url as string),
        recommendation: `Temat "${topicText}" pojawia się u ${uniqueDomains.length} konkurentów. Stwórz ${contentType} odpowiadający na potrzeby użytkowników.`,
      });
    }
  }

  return gaps.sort((a, b) => {
    const priority = { high: 0, medium: 1, low: 2 };
    return priority[a.priority] - priority[b.priority];
  }).slice(0, 50);
}

export interface DuplicateIssue {
  urlA: string;
  urlB: string;
  type: string;
  similarity: number;
  recommendation: string;
}

export async function detectDuplicates(projectId: string): Promise<DuplicateIssue[]> {
  const db = getDb();
  const pages = await db.execute({
    sql: `SELECT url, title, metaDescription, h1, wordCount FROM pages WHERE projectId = ? AND isIndexable = 1`,
    args: [projectId],
  });

  const issues: DuplicateIssue[] = [];
  const rows = pages.rows;

  // Duplicate titles
  const titleMap = new Map<string, string[]>();
  rows.forEach(p => {
    if (p.title) {
      const key = (p.title as string).toLowerCase().trim();
      if (!titleMap.has(key)) titleMap.set(key, []);
      titleMap.get(key)!.push(p.url as string);
    }
  });

  for (const [, urls] of titleMap) {
    if (urls.length > 1) {
      for (let i = 0; i < urls.length - 1; i++) {
        issues.push({
          urlA: urls[i], urlB: urls[i + 1],
          type: 'Duplikat title',
          similarity: 100,
          recommendation: 'Przepisz title, aby był unikalny dla każdej strony. Użyj głównej frazy kluczowej charakterystycznej dla danej podstrony.',
        });
      }
    }
  }

  // Duplicate meta descriptions
  const descMap = new Map<string, string[]>();
  rows.forEach(p => {
    if (p.metaDescription) {
      const key = (p.metaDescription as string).toLowerCase().trim();
      if (!descMap.has(key)) descMap.set(key, []);
      descMap.get(key)!.push(p.url as string);
    }
  });

  for (const [, urls] of descMap) {
    if (urls.length > 1) {
      for (let i = 0; i < urls.length - 1; i++) {
        issues.push({
          urlA: urls[i], urlB: urls[i + 1],
          type: 'Duplikat meta description',
          similarity: 100,
          recommendation: 'Każda strona powinna mieć unikalny meta description opisujący jej treść.',
        });
      }
    }
  }

  // Similar H1s (Jaccard)
  const h1Rows = rows.filter(p => p.h1);
  for (let i = 0; i < Math.min(h1Rows.length, 100); i++) {
    for (let j = i + 1; j < Math.min(h1Rows.length, 100); j++) {
      const tokensA = extractTokens(h1Rows[i].h1 as string);
      const tokensB = extractTokens(h1Rows[j].h1 as string);
      const sim = jaccardSimilarity(tokensA, tokensB);
      if (sim > 0.6) {
        issues.push({
          urlA: h1Rows[i].url as string,
          urlB: h1Rows[j].url as string,
          type: 'Podobne H1 - potencjalna kanibalizacja',
          similarity: Math.round(sim * 100),
          recommendation: sim > 0.8 ? 'Rozważ połączenie stron lub wyraźne rozróżnienie intencji użytkownika.' : 'Sprawdź czy strony nie konkurują o te same frazy kluczowe.',
        });
      }
    }
  }

  return issues.slice(0, 100);
}

export async function generateRecommendations(projectId: string): Promise<void> {
  const db = getDb();

  // Delete old recommendations
  await db.execute({ sql: `DELETE FROM recommendations WHERE projectId = ?`, args: [projectId] });

  const pages = await db.execute({
    sql: `SELECT * FROM pages WHERE projectId = ?`,
    args: [projectId],
  });

  const { cuid } = await import('./db');

  for (const page of pages.rows) {
    const recs: { priority: string; category: string; title: string; description: string; action: string; seoImpact: string; difficulty: string }[] = [];

    if (!page.title) {
      recs.push({ priority: 'critical', category: 'On-Page SEO', title: 'Brak title', description: `Strona ${page.url} nie ma ustawionego tagu title.`, action: `Dodaj unikalny title (50-60 znaków) z główną frazą kluczową.`, seoImpact: 'Bardzo wysoki', difficulty: 'Łatwe' });
    } else if ((page.titleLength as number) < 30) {
      recs.push({ priority: 'high', category: 'On-Page SEO', title: 'Zbyt krótki title', description: `Title ma tylko ${page.titleLength} znaków.`, action: 'Rozbuduj title do 50-60 znaków.', seoImpact: 'Wysoki', difficulty: 'Łatwe' });
    } else if ((page.titleLength as number) > 70) {
      recs.push({ priority: 'medium', category: 'On-Page SEO', title: 'Zbyt długi title', description: `Title ma ${page.titleLength} znaków — może być ucięty w SERP.`, action: 'Skróć title do max 60 znaków.', seoImpact: 'Średni', difficulty: 'Łatwe' });
    }

    if (!page.metaDescription) {
      recs.push({ priority: 'high', category: 'On-Page SEO', title: 'Brak meta description', description: `Strona ${page.url} nie ma meta description.`, action: 'Dodaj opis 140-160 znaków z wezwaniem do działania.', seoImpact: 'Wysoki', difficulty: 'Łatwe' });
    }

    if (!page.h1 || page.h1Count === 0) {
      recs.push({ priority: 'critical', category: 'On-Page SEO', title: 'Brak H1', description: `Strona nie ma nagłówka H1.`, action: 'Dodaj jeden unikalny H1 z główną frazą kluczową.', seoImpact: 'Bardzo wysoki', difficulty: 'Łatwe' });
    } else if ((page.h1Count as number) > 1) {
      recs.push({ priority: 'high', category: 'On-Page SEO', title: 'Wiele H1', description: `Strona ma ${page.h1Count} nagłówków H1.`, action: 'Zostaw tylko jeden H1 — główny nagłówek strony.', seoImpact: 'Wysoki', difficulty: 'Łatwe' });
    }

    if ((page.wordCount as number) < 300 && page.isIndexable) {
      recs.push({ priority: 'medium', category: 'Treść', title: 'Mało treści', description: `Strona ma tylko ${page.wordCount} słów.`, action: 'Rozbuduj treść do minimum 600 słów dla stron contentowych.', seoImpact: 'Wysoki', difficulty: 'Średnie' });
    }

    if ((page.internalLinksCount as number) === 0) {
      recs.push({ priority: 'medium', category: 'Linkowanie', title: 'Brak linków wewnętrznych', description: 'Strona nie ma żadnych linków wewnętrznych.', action: 'Dodaj 3-5 linków do powiązanych podstron.', seoImpact: 'Średni', difficulty: 'Łatwe' });
    }

    if (page.imagesCount && page.imagesNoAlt && (page.imagesNoAlt as number) > 0) {
      recs.push({ priority: 'medium', category: 'Obrazy', title: 'Obrazy bez alt', description: `${page.imagesNoAlt} z ${page.imagesCount} obrazów nie ma atrybutu alt.`, action: 'Dodaj opisowe teksty alt do wszystkich obrazów.', seoImpact: 'Średni', difficulty: 'Łatwe' });
    }

    if (!page.hasJsonLd && page.wordCount && (page.wordCount as number) > 300) {
      recs.push({ priority: 'low', category: 'Schema.org', title: 'Brak danych strukturalnych', description: 'Strona nie ma żadnych danych JSON-LD.', action: 'Dodaj odpowiedni schemat: Article, FAQPage, LocalBusiness lub MedicalWebPage.', seoImpact: 'Średni', difficulty: 'Średnie' });
    }

    for (const rec of recs) {
      await db.execute({
        sql: `INSERT INTO recommendations (id, projectId, domain, url, priority, category, title, description, action, seoImpact, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [cuid(), projectId, page.domain as string, page.url as string, rec.priority, rec.category, rec.title, rec.description, rec.action, rec.seoImpact, rec.difficulty],
      });
    }
  }
}
