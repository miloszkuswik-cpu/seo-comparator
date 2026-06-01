import * as cheerio from 'cheerio';

const POLISH_CITIES = ['łódź', 'warszawa', 'kraków', 'wrocław', 'gdańsk', 'szczecin', 'poznań', 'katowice', 'kalisz', 'lublin', 'bydgoszcz', 'toruń'];

const CTA_PATTERNS = [
  'umów wizytę', 'umów konsultację', 'umów badanie', 'zarezerwuj',
  'sprawdź ryzyko', 'zrób test', 'kontakt', 'konsultacja online',
  'diagnostyka', 'rejestracja', 'book appointment', 'schedule', 'contact us'
];

const WEAK_ANCHORS = ['kliknij tutaj', 'więcej', 'sprawdź', 'czytaj więcej', 'tutaj', 'click here', 'read more', 'more', 'here'];

export interface PageAnalysis {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescLength: number;
  canonical: string | null;
  metaRobots: string | null;
  isIndexable: boolean;
  h1: string | null;
  h1Count: number;
  h2List: string[];
  h3List: string[];
  wordCount: number;
  bodyText: string;
  internalLinksCount: number;
  externalLinksCount: number;
  internalLinks: { url: string; anchor: string }[];
  externalLinks: { url: string; anchor: string }[];
  imagesCount: number;
  imagesNoAlt: number;
  imageAlts: string[];
  hasOpenGraph: boolean;
  hasTwitterCards: boolean;
  hasJsonLd: boolean;
  schemaTypes: string[];
  hasFaqSchema: boolean;
  hasArticleSchema: boolean;
  hasMedicalWebPage: boolean;
  hasLocalBusiness: boolean;
  hasPhysician: boolean;
  hasMedicalClinic: boolean;
  hasCta: boolean;
  hasForm: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasBookingLink: boolean;
  detectedWidgets: string[];
  hasAuthor: boolean;
  authorBio: boolean;
  publishDate: string | null;
  updateDate: string | null;
  hasExternalSources: boolean;
  hasMedicalDisclaimer: boolean;
  hasCompanyInfo: boolean;
  hasTerms: boolean;
  hasPrivacyPolicy: boolean;
  hasContact: boolean;
  localCitiesFound: string[];
}

export function analyzeHtml(html: string, pageUrl: string, domain: string): PageAnalysis {
  const $ = cheerio.load(html);
  const baseHostname = new URL(`https://${domain}`).hostname;

  // Remove scripts and styles from text extraction
  $('script, style, noscript').remove();

  // Title
  const title = $('title').first().text().trim() || null;
  const titleLength = title?.length || 0;

  // Meta description
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;
  const metaDescLength = metaDescription?.length || 0;

  // Canonical
  const canonical = $('link[rel="canonical"]').attr('href') || null;

  // Meta robots
  const metaRobots = $('meta[name="robots"]').attr('content') || null;
  const isIndexable = !metaRobots?.includes('noindex') && !metaRobots?.includes('none');

  // Headings
  const h1Elements = $('h1');
  const h1Count = h1Elements.length;
  const h1 = h1Elements.first().text().trim() || null;
  const h2List = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean);
  const h3List = $('h3').map((_, el) => $(el).text().trim()).get().filter(Boolean);

  // Body text and word count
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 5000);
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  // Links
  const internalLinks: { url: string; anchor: string }[] = [];
  const externalLinks: { url: string; anchor: string }[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const anchor = $(el).text().trim() || $(el).attr('aria-label') || '';

    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    try {
      let absoluteUrl: string;
      if (href.startsWith('http://') || href.startsWith('https://')) {
        absoluteUrl = href;
      } else if (href.startsWith('/')) {
        absoluteUrl = `https://${baseHostname}${href}`;
      } else {
        absoluteUrl = `https://${baseHostname}/${href}`;
      }

      const linkHostname = new URL(absoluteUrl).hostname;
      if (linkHostname === baseHostname || linkHostname === `www.${baseHostname}` || `www.${linkHostname}` === baseHostname) {
        internalLinks.push({ url: absoluteUrl, anchor });
      } else {
        externalLinks.push({ url: absoluteUrl, anchor });
      }
    } catch {
      // skip invalid URLs
    }
  });

  // Images
  const images = $('img');
  const imagesCount = images.length;
  const imageAlts: string[] = [];
  let imagesNoAlt = 0;

  images.each((_, el) => {
    const alt = $(el).attr('alt');
    if (!alt || alt.trim() === '') {
      imagesNoAlt++;
    } else {
      imageAlts.push(alt.trim());
    }
  });

  // Open Graph
  const hasOpenGraph = $('meta[property^="og:"]').length > 0;
  const hasTwitterCards = $('meta[name^="twitter:"]').length > 0;

  // JSON-LD and Schema
  const schemaTypes: string[] = [];
  let hasFaqSchema = false;
  let hasArticleSchema = false;
  let hasMedicalWebPage = false;
  let hasLocalBusiness = false;
  let hasPhysician = false;
  let hasMedicalClinic = false;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      const schemas = Array.isArray(json) ? json : [json];
      schemas.forEach(schema => {
        const type = schema['@type'];
        if (type) {
          const types = Array.isArray(type) ? type : [type];
          types.forEach(t => {
            schemaTypes.push(t);
            if (t === 'FAQPage') hasFaqSchema = true;
            if (t === 'Article' || t === 'BlogPosting' || t === 'NewsArticle') hasArticleSchema = true;
            if (t === 'MedicalWebPage') hasMedicalWebPage = true;
            if (t === 'LocalBusiness') hasLocalBusiness = true;
            if (t === 'Physician') hasPhysician = true;
            if (t === 'MedicalClinic') hasMedicalClinic = true;
          });
        }
      });
    } catch { /* skip */ }
  });
  const hasJsonLd = schemaTypes.length > 0;

  // CTA detection
  const pageTextLower = $('body').text().toLowerCase();
  const hasCta = CTA_PATTERNS.some(p => pageTextLower.includes(p));
  const hasForm = $('form').length > 0;
  const hasPhone = /(\+48|00\s?48|\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b)/.test(html) || $('a[href^="tel:"]').length > 0;
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(html) || $('a[href^="mailto:"]').length > 0;

  const htmlLower = html.toLowerCase();
  const hasBookingLink = htmlLower.includes('umów') || htmlLower.includes('rejestracja') || htmlLower.includes('zarezerwuj') || $('a[href*="booking"]').length > 0;

  // Widget detection
  const detectedWidgets: string[] = [];
  if (htmlLower.includes('znany') || htmlLower.includes('znaniylekarze') || htmlLower.includes('docplanner')) detectedWidgets.push('ZnanyLekarz/Docplanner');
  if (htmlLower.includes('medfile')) detectedWidgets.push('Medfile');
  if (htmlLower.includes('calendly')) detectedWidgets.push('Calendly');
  if (htmlLower.includes('booksy')) detectedWidgets.push('Booksy');

  // E-E-A-T
  const hasAuthor = !!$('[rel="author"], .author, .byline, [itemprop="author"]').length || htmlLower.includes('autor:') || htmlLower.includes('written by');
  const authorBio = !!$('.author-bio, .author-description, [itemprop="description"]').length;
  const publishDate = $('[itemprop="datePublished"], time[datetime], meta[property="article:published_time"]').first().attr('datetime') || $('[itemprop="datePublished"]').first().attr('content') || null;
  const updateDate = $('[itemprop="dateModified"], meta[property="article:modified_time"]').first().attr('datetime') || null;
  const hasExternalSources = externalLinks.some(l => /ncbi|pubmed|scholar|who\.int|mz\.gov|nfz\.gov/.test(l.url));
  const hasMedicalDisclaimer = htmlLower.includes('nie stanowi porady medycznej') || htmlLower.includes('skonsultuj się z lekarzem') || htmlLower.includes('medical disclaimer') || htmlLower.includes('konsultacja z lekarzem');
  const hasCompanyInfo = !!$('footer').text().match(/nip|krs|regon|sp\. z o\.o|spółka/i);
  const hasTerms = htmlLower.includes('regulamin') || $('a[href*="regulamin"]').length > 0 || $('a[href*="terms"]').length > 0;
  const hasPrivacyPolicy = htmlLower.includes('polityka prywatności') || $('a[href*="privacy"]').length > 0 || $('a[href*="polityka"]').length > 0;
  const hasContact = $('a[href*="kontakt"], a[href*="contact"]').length > 0 || htmlLower.includes('napisz do nas') || htmlLower.includes('zadzwoń');

  // Local SEO
  const localCitiesFound = POLISH_CITIES.filter(city => pageTextLower.includes(city));

  return {
    title, titleLength, metaDescription, metaDescLength, canonical, metaRobots, isIndexable,
    h1, h1Count, h2List, h3List, wordCount, bodyText,
    internalLinksCount: internalLinks.length, externalLinksCount: externalLinks.length,
    internalLinks, externalLinks,
    imagesCount, imagesNoAlt, imageAlts,
    hasOpenGraph, hasTwitterCards, hasJsonLd, schemaTypes,
    hasFaqSchema, hasArticleSchema, hasMedicalWebPage, hasLocalBusiness, hasPhysician, hasMedicalClinic,
    hasCta, hasForm, hasPhone, hasEmail, hasBookingLink, detectedWidgets,
    hasAuthor, authorBio, publishDate, updateDate,
    hasExternalSources, hasMedicalDisclaimer, hasCompanyInfo, hasTerms, hasPrivacyPolicy, hasContact,
    localCitiesFound,
  };
}

export function scorePage(analysis: PageAnalysis): {
  technicalScore: number; onPageScore: number; contentScore: number;
  internalLinksScore: number; imageScore: number; schemaScore: number;
  medicalTrustScore: number; localSeoScore: number; conversionScore: number; overallScore: number;
} {
  // Technical Score
  let tech = 100;
  if (!analysis.isIndexable) tech -= 0; // noindex is intentional, no penalty here
  if (!analysis.canonical) tech -= 10;
  const t = tech;

  // On-Page Score
  let onPage = 100;
  if (!analysis.title) onPage -= 30;
  else if (analysis.titleLength < 30) onPage -= 15;
  else if (analysis.titleLength > 70) onPage -= 10;
  if (!analysis.metaDescription) onPage -= 20;
  else if (analysis.metaDescLength < 100) onPage -= 10;
  else if (analysis.metaDescLength > 165) onPage -= 5;
  if (analysis.h1Count === 0) onPage -= 25;
  else if (analysis.h1Count > 1) onPage -= 15;
  if (!analysis.hasOpenGraph) onPage -= 5;

  // Content Score
  let content = 100;
  if (analysis.wordCount < 100) content -= 40;
  else if (analysis.wordCount < 300) content -= 20;
  else if (analysis.wordCount < 600) content -= 10;
  if (analysis.h2List.length === 0) content -= 15;

  // Internal Links Score
  let intLinks = 100;
  if (analysis.internalLinksCount === 0) intLinks -= 50;
  else if (analysis.internalLinksCount < 3) intLinks -= 25;
  else if (analysis.internalLinksCount < 5) intLinks -= 10;

  // Image Score
  let imgs = 100;
  if (analysis.imagesCount > 0) {
    const noAltRatio = analysis.imagesNoAlt / analysis.imagesCount;
    imgs -= Math.round(noAltRatio * 60);
  }

  // Schema Score
  let schema = 0;
  if (analysis.hasJsonLd) schema += 40;
  if (analysis.hasFaqSchema) schema += 20;
  if (analysis.hasArticleSchema || analysis.hasMedicalWebPage) schema += 20;
  if (analysis.hasLocalBusiness || analysis.hasMedicalClinic) schema += 20;
  schema = Math.min(100, schema);

  // Medical Trust Score
  let medical = 0;
  if (analysis.hasAuthor) medical += 20;
  if (analysis.authorBio) medical += 10;
  if (analysis.publishDate) medical += 10;
  if (analysis.updateDate) medical += 10;
  if (analysis.hasExternalSources) medical += 15;
  if (analysis.hasMedicalDisclaimer) medical += 15;
  if (analysis.hasPrivacyPolicy) medical += 5;
  if (analysis.hasTerms) medical += 5;
  if (analysis.hasContact) medical += 5;
  if (analysis.hasMedicalWebPage || analysis.hasPhysician || analysis.hasMedicalClinic) medical += 5;
  medical = Math.min(100, medical);

  // Local SEO Score
  let local = 0;
  if (analysis.localCitiesFound.length > 0) local += 30;
  if (analysis.hasLocalBusiness || analysis.hasMedicalClinic) local += 30;
  if (analysis.hasPhone) local += 20;
  if (analysis.hasContact) local += 20;
  local = Math.min(100, local);

  // Conversion Score
  let conv = 0;
  if (analysis.hasCta) conv += 30;
  if (analysis.hasForm) conv += 20;
  if (analysis.hasPhone) conv += 20;
  if (analysis.hasEmail) conv += 10;
  if (analysis.hasBookingLink) conv += 15;
  if (analysis.detectedWidgets.length > 0) conv += 5;
  conv = Math.min(100, conv);

  const overall = Math.round((t + onPage + content + intLinks + imgs + schema) / 6);

  return {
    technicalScore: Math.max(0, t),
    onPageScore: Math.max(0, onPage),
    contentScore: Math.max(0, content),
    internalLinksScore: Math.max(0, intLinks),
    imageScore: Math.max(0, imgs),
    schemaScore: schema,
    medicalTrustScore: medical,
    localSeoScore: local,
    conversionScore: conv,
    overallScore: Math.max(0, overall),
  };
}

export function extractLinksFromHtml(html: string, baseUrl: string, domain: string): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];
  const baseHostname = new URL(baseUrl).hostname;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    // Skip non-HTML resources
    if (/\.(jpg|jpeg|png|webp|gif|svg|pdf|zip|css|js|xml|mp4|mov|avi|ico|woff|woff2|ttf|eot)(\?.*)?$/i.test(href)) return;

    try {
      let absoluteUrl: string;
      if (href.startsWith('http://') || href.startsWith('https://')) {
        absoluteUrl = href;
      } else if (href.startsWith('/')) {
        const base = new URL(baseUrl);
        absoluteUrl = `${base.protocol}//${base.hostname}${href}`;
      } else {
        const base = new URL(baseUrl);
        absoluteUrl = `${base.protocol}//${base.hostname}/${href}`;
      }

      const linkUrl = new URL(absoluteUrl);
      // Remove fragments
      linkUrl.hash = '';
      const cleanUrl = linkUrl.toString();

      const linkHostname = linkUrl.hostname;
      const isInternal = linkHostname === baseHostname || linkHostname === `www.${baseHostname}` || `www.${linkHostname}` === baseHostname;

      if (isInternal) {
        links.push(cleanUrl);
      }
    } catch { /* skip */ }
  });

  return [...new Set(links)];
}

export function getWeakAnchors(links: { url: string; anchor: string }[]): { url: string; anchor: string }[] {
  return links.filter(l => WEAK_ANCHORS.some(w => l.anchor.toLowerCase().includes(w)));
}
