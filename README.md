# SEO Comparator Pro

Lokalna aplikacja webowa do porównywania SEO wielu domen jednocześnie. Crawluje strony, analizuje dane SEO i generuje raporty porównawcze.

## Szybki start

```bash
npm install
npm run dev
```

Otwórz: http://localhost:3000

Baza SQLite (`dev.db`) jest tworzona automatycznie przy pierwszym uruchomieniu.

## Wymagania

- Node.js 18+
- npm 9+

## Konfiguracja .env

```env
DATABASE_URL="file:./dev.db"
```

## Funkcje MVP

- Crawl sitemap.xml + BFS fallback
- Analiza HTML: title, meta desc, H1-H3, treść, linki, obrazy, schema.org
- Scoring 0-100 na podstronę i domenę
- Tabela porównawcza domen
- Content Gap Analysis (Jaccard similarity)
- Duplikaty title/meta/H1
- Mapa linkowania wewnętrznego
- Medical SEO / E-E-A-T
- Local SEO (wykrywanie miast PL)
- CTA/Konwersja
- Eksport CSV + XLSX

## Stack

- Next.js 15 App Router + TypeScript + Tailwind CSS
- SQLite via @libsql/client
- Cheerio (HTML parsing)
- xlsx (eksport)

## Ograniczenia MVP

- Brak renderowania JS (SPA bez SSR nie zostanie zindeksowane)
- Brak eksportu PDF
- Content Gap — prosty Jaccard, bez NLP
- SQLite — nie dla wielu użytkowników

## Wdrożenie na VPS

```bash
npm run build
npm start
```

## Dlaczego nie Vercel?

Vercel Functions mają timeout 10-60s. Crawl 50 stron zajmuje kilka minut.
SQLite wymaga trwałego dysku (Vercel go nie ma).
Dla Vercel: zamień SQLite na Turso, crawl na BullMQ/worker.

## Plan rozwoju

- PDF eksport
- Playwright (renderowanie JS)
- Google Search Console integracja
- Multi-user z NextAuth
- Turso dla produkcji
