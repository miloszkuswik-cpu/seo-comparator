import { createClient } from '@libsql/client';
import path from 'path';

const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || './dev.db';
const dbUrl = `file:${path.resolve(process.cwd(), DB_PATH)}`;

let client: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (!client) {
    client = createClient({ url: dbUrl });
  }
  return client;
}

export async function initDb() {
  const db = getDb();

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domains TEXT NOT NULL,
      myDomain TEXT,
      maxPages INTEGER DEFAULT 50,
      modules TEXT NOT NULL,
      status TEXT DEFAULT 'idle',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crawl_runs (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      domain TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      startedAt TEXT,
      finishedAt TEXT,
      error TEXT,
      pagesFound INTEGER DEFAULT 0,
      pagesAnalyzed INTEGER DEFAULT 0,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      crawlRunId TEXT NOT NULL,
      projectId TEXT NOT NULL,
      domain TEXT NOT NULL,
      url TEXT NOT NULL,
      finalUrl TEXT,
      statusCode INTEGER,
      isRedirect INTEGER DEFAULT 0,
      contentType TEXT,
      fetchTimeMs INTEGER,
      error TEXT,
      title TEXT,
      titleLength INTEGER,
      metaDescription TEXT,
      metaDescLength INTEGER,
      canonical TEXT,
      metaRobots TEXT,
      isIndexable INTEGER DEFAULT 1,
      h1 TEXT,
      h1Count INTEGER DEFAULT 0,
      h2List TEXT,
      h3List TEXT,
      wordCount INTEGER DEFAULT 0,
      bodyText TEXT,
      internalLinksCount INTEGER DEFAULT 0,
      externalLinksCount INTEGER DEFAULT 0,
      internalLinks TEXT,
      externalLinks TEXT,
      imagesCount INTEGER DEFAULT 0,
      imagesNoAlt INTEGER DEFAULT 0,
      imageAlts TEXT,
      hasOpenGraph INTEGER DEFAULT 0,
      hasTwitterCards INTEGER DEFAULT 0,
      hasJsonLd INTEGER DEFAULT 0,
      schemaTypes TEXT,
      hasFaqSchema INTEGER DEFAULT 0,
      hasArticleSchema INTEGER DEFAULT 0,
      hasMedicalWebPage INTEGER DEFAULT 0,
      hasLocalBusiness INTEGER DEFAULT 0,
      hasPhysician INTEGER DEFAULT 0,
      hasMedicalClinic INTEGER DEFAULT 0,
      hasCta INTEGER DEFAULT 0,
      hasForm INTEGER DEFAULT 0,
      hasPhone INTEGER DEFAULT 0,
      hasEmail INTEGER DEFAULT 0,
      hasBookingLink INTEGER DEFAULT 0,
      detectedWidgets TEXT,
      hasAuthor INTEGER DEFAULT 0,
      authorBio INTEGER DEFAULT 0,
      publishDate TEXT,
      updateDate TEXT,
      hasExternalSources INTEGER DEFAULT 0,
      hasMedicalDisclaimer INTEGER DEFAULT 0,
      hasCompanyInfo INTEGER DEFAULT 0,
      hasTerms INTEGER DEFAULT 0,
      hasPrivacyPolicy INTEGER DEFAULT 0,
      hasContact INTEGER DEFAULT 0,
      technicalScore REAL DEFAULT 0,
      onPageScore REAL DEFAULT 0,
      contentScore REAL DEFAULT 0,
      internalLinksScore REAL DEFAULT 0,
      imageScore REAL DEFAULT 0,
      schemaScore REAL DEFAULT 0,
      medicalTrustScore REAL DEFAULT 0,
      localSeoScore REAL DEFAULT 0,
      conversionScore REAL DEFAULT 0,
      overallScore REAL DEFAULT 0,
      FOREIGN KEY (crawlRunId) REFERENCES crawl_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pages_project_domain ON pages(projectId, domain);
    CREATE INDEX IF NOT EXISTS idx_pages_url ON pages(url);

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      domain TEXT NOT NULL,
      url TEXT,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      domain TEXT,
      url TEXT,
      priority TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      action TEXT,
      seoImpact TEXT,
      difficulty TEXT,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      type TEXT NOT NULL,
      filename TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  return db;
}

export function cuid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `c${timestamp}${randomPart}`;
}
