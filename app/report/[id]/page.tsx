'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type TabId = 'overview' | 'domains' | 'pages' | 'contentgap' | 'duplicates' | 'links' | 'medical' | 'local' | 'recommendations' | 'export';

interface DomainStats {
  domain: string; totalPages: number; indexablePages: number; noindexPages: number;
  errors404: number; errors500: number; redirects: number;
  avgTitleLength: number; missingTitlePct: number; duplicateTitlePct: number;
  missingMetaDescPct: number; duplicateMetaDescPct: number; noH1Pct: number; multipleH1Pct: number;
  avgWordCount: number; avgInternalLinks: number; avgExternalLinks: number; imagesNoAltPct: number;
  faqSchemaCount: number; articleSchemaCount: number; medicalWebPageCount: number; localBusinessCount: number; ctaCount: number;
  avgTechnicalScore: number; avgOnPageScore: number; avgContentScore: number;
  avgInternalLinksScore: number; avgMedicalTrustScore: number; avgConversionScore: number; overallScore: number;
}

interface Page {
  id: string; domain: string; url: string; statusCode: number; title: string;
  titleLength: number; metaDescription: string; h1: string; h1Count: number;
  wordCount: number; internalLinksCount: number; externalLinksCount: number;
  imagesCount: number; imagesNoAlt: number; isIndexable: number | boolean;
  hasOpenGraph: number | boolean; hasJsonLd: number | boolean; hasCta: number | boolean;
  hasForm: number | boolean; hasPhone: number | boolean;
  technicalScore: number; onPageScore: number; contentScore: number; overallScore: number;
}

interface ContentGapTopic {
  topic: string; competitorDomains: string[]; exampleUrls: string[];
  priority: 'high' | 'medium' | 'low'; contentType: string;
  suggestedTitle: string; suggestedH1: string; suggestedH2s: string[];
  recommendation: string;
}

interface DuplicateIssue { urlA: string; urlB: string; type: string; similarity: number; recommendation: string; }

interface Recommendation {
  id: string; priority: string; category: string; title: string;
  description: string; action: string; seoImpact: string; difficulty: string;
  url: string; domain: string;
}

interface ReportData {
  project: { id: string; name: string; status: string; domains: string[]; myDomain: string | null; modules: string[] };
  domainStats: DomainStats[];
  pages: Page[];
  totalPages: number;
  contentGap: ContentGapTopic[];
  duplicates: DuplicateIssue[];
  recommendations: Recommendation[];
  internalLinksMap: { incomingLinks: Record<string, number>; orphanPages: string[] };
}

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 80 ? 'score-great' : score >= 60 ? 'score-good' : score >= 40 ? 'score-medium' : score >= 20 ? 'score-low' : 'score-critical';
  return <span className={`score-badge ${cls}`}>{Math.round(score)}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-900 text-red-200', high: 'bg-orange-900 text-orange-200',
    medium: 'bg-yellow-900 text-yellow-200', low: 'bg-blue-900 text-blue-200',
  };
  const labels: Record<string, string> = { critical: 'Krytyczny', high: 'Wysoki', medium: 'Średni', low: 'Niski' };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[priority] || 'bg-gray-700 text-gray-300'}`}>{labels[priority] || priority}</span>;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'domains', label: 'Domeny', icon: '🌐' },
  { id: 'pages', label: 'Podstrony', icon: '📄' },
  { id: 'contentgap', label: 'Content Gap', icon: '🔍' },
  { id: 'duplicates', label: 'Duplikaty', icon: '🔄' },
  { id: 'links', label: 'Linkowanie', icon: '🔗' },
  { id: 'medical', label: 'Medical SEO', icon: '🏥' },
  { id: 'local', label: 'Local SEO', icon: '📍' },
  { id: 'recommendations', label: 'Rekomendacje', icon: '💡' },
  { id: 'export', label: 'Eksport', icon: '💾' },
];

export default function ReportPage({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState<TabId>('overview');
  const [data, setData] = useState<ReportData | null>(null);
  const [status, setStatus] = useState<{ status: string; runs: { domain: string; status: string; pagesFound: number; pagesAnalyzed: number }[] }>({ status: 'idle', runs: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [sortField, setSortField] = useState<string>('overallScore');
  const [sortAsc, setSortAsc] = useState(true);
  const [pageNum, setPageNum] = useState(1);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/projects/${params.id}/status`);
    if (res.ok) {
      const s = await res.json();
      setStatus(s);
      return s.status;
    }
    return 'error';
  }, [params.id]);

  const fetchReport = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(pageNum) });
    if (search) qs.set('search', search);
    if (domainFilter) qs.set('domain', domainFilter);
    const res = await fetch(`/api/projects/${params.id}/report?${qs}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [params.id, pageNum, search, domainFilter]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const poll = async () => {
      const s = await fetchStatus();
      if (s === 'running') {
        interval = setInterval(async () => {
          const st = await fetchStatus();
          if (st !== 'running') {
            clearInterval(interval);
            fetchReport();
          }
        }, 3000);
      } else {
        fetchReport();
      }
    };
    poll();
    return () => clearInterval(interval);
  }, [fetchStatus, fetchReport]);

  useEffect(() => {
    if (data) fetchReport();
  }, [pageNum, search, domainFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        {status.status === 'running' && (
          <div className="card max-w-md w-full space-y-3">
            <p className="font-medium text-center">Trwa analiza SEO...</p>
            {status.runs.map(r => (
              <div key={r.domain} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">{r.domain}</span>
                  <span className="text-gray-500">{r.pagesAnalyzed}/{r.pagesFound} stron</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: r.pagesFound > 0 ? `${(r.pagesAnalyzed / r.pagesFound) * 100}%` : '5%' }} />
                </div>
                <p className="text-xs text-gray-600">{statusLabel(r.status)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!data) return <div className="min-h-screen flex items-center justify-center text-red-400">Błąd ładowania raportu.</div>;

  const { project, domainStats, pages, contentGap, duplicates, recommendations, internalLinksMap } = data;

  const sortedPages = [...pages].sort((a, b) => {
    const va = (a as any)[sortField] ?? 0;
    const vb = (b as any)[sortField] ?? 0;
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const toggleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const bestDomain = [...domainStats].sort((a, b) => b.overallScore - a.overallScore)[0];
  const worstDomain = [...domainStats].sort((a, b) => a.overallScore - b.overallScore)[0];

  const criticalRecs = recommendations.filter(r => r.priority === 'critical');
  const highRecs = recommendations.filter(r => r.priority === 'high');

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← Powrót</Link>
          <div className="h-4 w-px bg-gray-700" />
          <div>
            <h1 className="font-semibold text-sm">{project.name}</h1>
            <p className="text-xs text-gray-500">{project.domains.join(', ')}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${project.status === 'done' ? 'bg-green-900 text-green-300' : project.status === 'running' ? 'bg-yellow-900 text-yellow-300' : project.status === 'error' ? 'bg-red-900 text-red-300' : 'bg-gray-800 text-gray-400'}`}>
              {project.status === 'done' ? '✅ Gotowe' : project.status === 'running' ? '⏳ W trakcie' : project.status === 'error' ? '❌ Błąd' : 'Oczekuje'}
            </span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`tab-btn whitespace-nowrap ${tab === t.id ? 'tab-active' : 'tab-inactive'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card-sm">
                <p className="text-xs text-gray-500 mb-1">Analizowane domeny</p>
                <p className="text-2xl font-bold">{domainStats.length}</p>
              </div>
              <div className="card-sm">
                <p className="text-xs text-gray-500 mb-1">Łącznie podstron</p>
                <p className="text-2xl font-bold">{domainStats.reduce((s, d) => s + d.totalPages, 0)}</p>
              </div>
              <div className="card-sm">
                <p className="text-xs text-gray-500 mb-1">Krytyczne problemy</p>
                <p className="text-2xl font-bold text-red-400">{criticalRecs.length}</p>
              </div>
              <div className="card-sm">
                <p className="text-xs text-gray-500 mb-1">Wszystkie rekomendacje</p>
                <p className="text-2xl font-bold text-yellow-400">{recommendations.length}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {bestDomain && (
                <div className="card-sm border-l-4 border-green-600">
                  <p className="text-xs text-gray-500 mb-1">🏆 Najlepsza domena</p>
                  <p className="font-semibold">{bestDomain.domain}</p>
                  <div className="flex gap-2 mt-2">
                    <ScoreBadge score={bestDomain.overallScore} />
                    <span className="text-xs text-gray-400">Overall Score</span>
                  </div>
                </div>
              )}
              {worstDomain && worstDomain.domain !== bestDomain?.domain && (
                <div className="card-sm border-l-4 border-red-700">
                  <p className="text-xs text-gray-500 mb-1">⚠️ Wymaga poprawy</p>
                  <p className="font-semibold">{worstDomain.domain}</p>
                  <div className="flex gap-2 mt-2">
                    <ScoreBadge score={worstDomain.overallScore} />
                    <span className="text-xs text-gray-400">Overall Score</span>
                  </div>
                </div>
              )}
            </div>

            {/* Score comparison */}
            <div className="card overflow-x-auto">
              <h2 className="font-semibold mb-4">Porównanie scoringów domen</h2>
              <table>
                <thead>
                  <tr>
                    <th>Domena</th>
                    <th>Techniczny</th>
                    <th>On-Page</th>
                    <th>Treść</th>
                    <th>Linkowanie</th>
                    <th>Medical</th>
                    <th>Konwersja</th>
                    <th>Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {domainStats.map(d => (
                    <tr key={d.domain}>
                      <td className="font-medium">{d.domain}</td>
                      <td><ScoreBadge score={d.avgTechnicalScore} /></td>
                      <td><ScoreBadge score={d.avgOnPageScore} /></td>
                      <td><ScoreBadge score={d.avgContentScore} /></td>
                      <td><ScoreBadge score={d.avgInternalLinksScore} /></td>
                      <td><ScoreBadge score={d.avgMedicalTrustScore} /></td>
                      <td><ScoreBadge score={d.avgConversionScore} /></td>
                      <td><ScoreBadge score={d.overallScore} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Top issues */}
            {criticalRecs.slice(0, 5).length > 0 && (
              <div className="card space-y-3">
                <h2 className="font-semibold">🚨 Krytyczne problemy</h2>
                {criticalRecs.slice(0, 5).map(r => (
                  <div key={r.id} className="priority-critical rounded-lg p-3">
                    <p className="font-medium text-sm text-red-200">{r.title}</p>
                    <p className="text-xs text-gray-400 mt-1 truncate">{r.url}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.action}</p>
                  </div>
                ))}
                {criticalRecs.length > 5 && <p className="text-xs text-gray-500">+ {criticalRecs.length - 5} więcej. Zobacz zakładkę Rekomendacje.</p>}
              </div>
            )}
          </div>
        )}

        {/* DOMAINS TAB */}
        {tab === 'domains' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Porównanie domen</h2>
            <div className="card overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Domena</th>
                    <th>URL-e</th>
                    <th>Ind.</th>
                    <th>404</th>
                    <th>Red.</th>
                    <th>Brak Title</th>
                    <th>Brak Meta</th>
                    <th>Brak H1</th>
                    <th>Img/Alt</th>
                    <th>Avg Słowa</th>
                    <th>FAQ</th>
                    <th>CTA</th>
                    <th>Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {domainStats.map(d => (
                    <tr key={d.domain}>
                      <td className="font-medium text-blue-300">{d.domain}</td>
                      <td>{d.totalPages}</td>
                      <td className={d.noindexPages > 0 ? 'text-yellow-400' : ''}>{d.indexablePages}</td>
                      <td className={d.errors404 > 0 ? 'text-red-400' : ''}>{d.errors404}</td>
                      <td>{d.redirects}</td>
                      <td className={d.missingTitlePct > 10 ? 'text-red-400' : d.missingTitlePct > 0 ? 'text-yellow-400' : 'text-green-400'}>{d.missingTitlePct}%</td>
                      <td className={d.missingMetaDescPct > 10 ? 'text-red-400' : d.missingMetaDescPct > 0 ? 'text-yellow-400' : 'text-green-400'}>{d.missingMetaDescPct}%</td>
                      <td className={d.noH1Pct > 10 ? 'text-red-400' : d.noH1Pct > 0 ? 'text-yellow-400' : 'text-green-400'}>{d.noH1Pct}%</td>
                      <td className={d.imagesNoAltPct > 20 ? 'text-red-400' : d.imagesNoAltPct > 0 ? 'text-yellow-400' : 'text-green-400'}>{d.imagesNoAltPct}%</td>
                      <td>{d.avgWordCount}</td>
                      <td>{d.faqSchemaCount}</td>
                      <td>{d.ctaCount}</td>
                      <td><ScoreBadge score={d.overallScore} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detailed domain cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {domainStats.map(d => (
                <div key={d.domain} className="card space-y-3">
                  <h3 className="font-semibold text-blue-300">{d.domain}</h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Techniczny', v: d.avgTechnicalScore },
                      { label: 'On-Page', v: d.avgOnPageScore },
                      { label: 'Treść', v: d.avgContentScore },
                      { label: 'Linki', v: d.avgInternalLinksScore },
                      { label: 'Medical', v: d.avgMedicalTrustScore },
                      { label: 'Konwersja', v: d.avgConversionScore },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-800 rounded-lg p-2">
                        <ScoreBadge score={item.v} />
                        <p className="text-xs text-gray-500 mt-1">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <p className="text-gray-400">Stron: <span className="text-white">{d.totalPages}</span></p>
                    <p className="text-gray-400">Avg słów: <span className="text-white">{d.avgWordCount}</span></p>
                    <p className="text-gray-400">Dup. title: <span className={d.duplicateTitlePct > 0 ? 'text-yellow-400' : 'text-white'}>{d.duplicateTitlePct}%</span></p>
                    <p className="text-gray-400">Dup. meta: <span className={d.duplicateMetaDescPct > 0 ? 'text-yellow-400' : 'text-white'}>{d.duplicateMetaDescPct}%</span></p>
                    <p className="text-gray-400">Multi H1: <span className={d.multipleH1Pct > 0 ? 'text-yellow-400' : 'text-white'}>{d.multipleH1Pct}%</span></p>
                    <p className="text-gray-400">FAQ schema: <span className="text-white">{d.faqSchemaCount}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PAGES TAB */}
        {tab === 'pages' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="search"
                placeholder="Szukaj URL..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPageNum(1); }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <select
                value={domainFilter}
                onChange={e => { setDomainFilter(e.target.value); setPageNum(1); }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Wszystkie domeny</option>
                {project.domains.map(d => <option key={d} value={d.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}>{d}</option>)}
              </select>
              <span className="text-sm text-gray-500">{data.totalPages} stron</span>
            </div>

            <div className="card overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th className="cursor-pointer" onClick={() => toggleSort('url')}>URL {sortField === 'url' ? (sortAsc ? '↑' : '↓') : ''}</th>
                    <th>Status</th>
                    <th className="cursor-pointer" onClick={() => toggleSort('titleLength')}>Title</th>
                    <th className="cursor-pointer" onClick={() => toggleSort('wordCount')}>Słowa</th>
                    <th className="cursor-pointer" onClick={() => toggleSort('internalLinksCount')}>Int. linki</th>
                    <th>Img/Alt</th>
                    <th>JSON-LD</th>
                    <th>CTA</th>
                    <th className="cursor-pointer" onClick={() => toggleSort('technicalScore')}>Tech</th>
                    <th className="cursor-pointer" onClick={() => toggleSort('onPageScore')}>OnPage</th>
                    <th className="cursor-pointer" onClick={() => toggleSort('overallScore')}>Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPages.map(p => (
                    <tr key={p.id}>
                      <td>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs block max-w-xs truncate">{p.url}</a>
                        {p.title && <p className="text-xs text-gray-500 truncate max-w-xs">{p.title}</p>}
                      </td>
                      <td>
                        <span className={`text-xs ${p.statusCode >= 400 ? 'text-red-400' : p.statusCode >= 300 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {p.statusCode || '—'}
                        </span>
                      </td>
                      <td>
                        {!p.title ? <span className="text-red-400 text-xs">Brak</span> :
                          <span className={`text-xs ${p.titleLength > 70 || p.titleLength < 30 ? 'text-yellow-400' : 'text-green-400'}`}>{p.titleLength}z</span>}
                      </td>
                      <td className={`text-xs ${(p.wordCount || 0) < 300 ? 'text-yellow-400' : ''}`}>{p.wordCount || 0}</td>
                      <td className={`text-xs ${(p.internalLinksCount || 0) === 0 ? 'text-red-400' : ''}`}>{p.internalLinksCount || 0}</td>
                      <td className={`text-xs ${(p.imagesNoAlt || 0) > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{p.imagesNoAlt || 0}/{p.imagesCount || 0}</td>
                      <td><span className={`text-xs ${p.hasJsonLd ? 'text-green-400' : 'text-gray-600'}`}>{p.hasJsonLd ? '✓' : '✗'}</span></td>
                      <td><span className={`text-xs ${p.hasCta ? 'text-green-400' : 'text-gray-600'}`}>{p.hasCta ? '✓' : '✗'}</span></td>
                      <td><ScoreBadge score={p.technicalScore || 0} /></td>
                      <td><ScoreBadge score={p.onPageScore || 0} /></td>
                      <td><ScoreBadge score={p.overallScore || 0} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.totalPages > 50 && (
              <div className="flex gap-2 justify-center items-center text-sm">
                <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum === 1} className="btn btn-secondary disabled:opacity-40">← Poprzednia</button>
                <span className="text-gray-400">Strona {pageNum} z {Math.ceil(data.totalPages / 50)}</span>
                <button onClick={() => setPageNum(p => p + 1)} disabled={pageNum >= Math.ceil(data.totalPages / 50)} className="btn btn-secondary disabled:opacity-40">Następna →</button>
              </div>
            )}
          </div>
        )}

        {/* CONTENT GAP TAB */}
        {tab === 'contentgap' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Content Gap Analysis</h2>
              {project.myDomain ?
                <p className="text-gray-400 text-sm mt-1">Moja domena: <span className="text-blue-300">{project.myDomain}</span> vs {project.domains.filter(d => !d.includes(project.myDomain!)).join(', ')}</p> :
                <p className="text-yellow-400 text-sm mt-1">⚠️ Nie wybrano "mojej domeny". Wróć do dashboardu i skonfiguruj projekt.</p>
              }
            </div>
            {contentGap.length === 0 ? (
              <div className="card text-center py-10 text-gray-500">
                {project.myDomain ? 'Nie znaleziono braków treści lub brak danych.' : 'Wybierz moją domenę, aby uruchomić analizę.'}
              </div>
            ) : (
              <div className="space-y-4">
                {contentGap.map((topic, i) => (
                  <div key={i} className={`card p-4 border-l-4 ${topic.priority === 'high' ? 'border-red-500' : topic.priority === 'medium' ? 'border-yellow-500' : 'border-blue-500'}`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="font-semibold">{topic.topic}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Typ treści: {topic.contentType} • U konkurentów: {topic.competitorDomains.join(', ')}</p>
                      </div>
                      <PriorityBadge priority={topic.priority} />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Sugerowany title</p>
                        <p className="text-gray-200">{topic.suggestedTitle}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mt-2">Sugerowany H1</p>
                        <p className="text-gray-200">{topic.suggestedH1}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sugerowane H2</p>
                        <ul className="space-y-0.5">
                          {topic.suggestedH2s.map((h, j) => <li key={j} className="text-xs text-gray-300">• {h}</li>)}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-3 bg-gray-800 rounded-lg p-2 text-xs text-gray-300">💡 {topic.recommendation}</div>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {topic.exampleUrls.map((u, j) => (
                        <a key={j} href={u} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate max-w-xs">{u}</a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DUPLICATES TAB */}
        {tab === 'duplicates' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Duplikaty i Kanibalizacja</h2>
            {duplicates.length === 0 ? (
              <div className="card text-center py-10 text-green-400">✅ Nie wykryto problemów z duplikacją.</div>
            ) : (
              <div className="card overflow-x-auto">
                <p className="text-sm text-gray-400 mb-4">Znaleziono {duplicates.length} problemów.</p>
                <table>
                  <thead>
                    <tr><th>URL A</th><th>URL B</th><th>Typ</th><th>Podobieństwo</th><th>Rekomendacja</th></tr>
                  </thead>
                  <tbody>
                    {duplicates.map((d, i) => (
                      <tr key={i}>
                        <td><a href={d.urlA} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs truncate block max-w-[200px]">{d.urlA}</a></td>
                        <td><a href={d.urlB} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs truncate block max-w-[200px]">{d.urlB}</a></td>
                        <td><span className="text-xs bg-gray-800 px-2 py-0.5 rounded">{d.type}</span></td>
                        <td><span className={`text-xs font-bold ${d.similarity >= 90 ? 'text-red-400' : d.similarity >= 70 ? 'text-yellow-400' : 'text-gray-400'}`}>{d.similarity}%</span></td>
                        <td className="text-xs text-gray-400 max-w-[250px]">{d.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* LINKS TAB */}
        {tab === 'links' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Mapa Linkowania Wewnętrznego</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="card-sm">
                <p className="text-xs text-gray-500 mb-1">Strony-sieroty</p>
                <p className="text-2xl font-bold text-red-400">{internalLinksMap.orphanPages.length}</p>
                <p className="text-xs text-gray-500">brak linków przychodzących</p>
              </div>
              <div className="card-sm">
                <p className="text-xs text-gray-500 mb-1">Łącznie przeanalizowanych URL</p>
                <p className="text-2xl font-bold">{pages.length}</p>
              </div>
              <div className="card-sm">
                <p className="text-xs text-gray-500 mb-1">Średnia linków wych./strona</p>
                <p className="text-2xl font-bold">
                  {pages.length > 0 ? Math.round(pages.reduce((s, p) => s + (p.internalLinksCount || 0), 0) / pages.length) : 0}
                </p>
              </div>
            </div>
            {internalLinksMap.orphanPages.length > 0 && (
              <div className="card">
                <h3 className="font-semibold mb-3">⚠️ Strony-sieroty (brak linków przychodzących)</h3>
                <ul className="space-y-1">
                  {internalLinksMap.orphanPages.slice(0, 30).map((url, i) => (
                    <li key={i}><a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs">{url}</a></li>
                  ))}
                  {internalLinksMap.orphanPages.length > 30 && <li className="text-xs text-gray-500">+ {internalLinksMap.orphanPages.length - 30} więcej</li>}
                </ul>
              </div>
            )}
            <div className="card overflow-x-auto">
              <h3 className="font-semibold mb-3">Strony z największą liczbą linków przychodzących</h3>
              <table>
                <thead><tr><th>URL</th><th>Linki przych.</th><th>Linki wych.</th><th>Overall Score</th></tr></thead>
                <tbody>
                  {[...pages]
                    .map(p => ({ ...p, incoming: internalLinksMap.incomingLinks[p.url] || 0 }))
                    .sort((a, b) => b.incoming - a.incoming)
                    .slice(0, 20)
                    .map(p => (
                      <tr key={p.id}>
                        <td><a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs truncate block max-w-sm">{p.url}</a></td>
                        <td className="text-green-400">{p.incoming}</td>
                        <td>{p.internalLinksCount || 0}</td>
                        <td><ScoreBadge score={p.overallScore || 0} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MEDICAL SEO TAB */}
        {tab === 'medical' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Medical SEO / E-E-A-T</h2>
            {domainStats.map(d => {
              const domainPages = pages.filter(p => p.domain === d.domain);
              const medicalPages = domainPages.filter(p => (p as any).hasMedicalWebPage || (p as any).hasPhysician || (p as any).hasMedicalClinic);
              const withAuthor = domainPages.filter(p => (p as any).hasAuthor).length;
              const withDisclaimer = domainPages.filter(p => (p as any).hasMedicalDisclaimer).length;
              return (
                <div key={d.domain} className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-blue-300">{d.domain}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Medical Trust Score</span>
                      <ScoreBadge score={d.avgMedicalTrustScore} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {[
                      { label: 'Strony z autorem', v: withAuthor, total: domainPages.length },
                      { label: 'Disclaimer medyczny', v: withDisclaimer, total: domainPages.length },
                      { label: 'MedicalWebPage schema', v: d.medicalWebPageCount, total: domainPages.length },
                      { label: 'LocalBusiness schema', v: d.localBusinessCount, total: domainPages.length },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-800 rounded-lg p-3">
                        <p className="text-2xl font-bold">{item.v}</p>
                        <p className="text-xs text-gray-400">{item.label}</p>
                        <p className="text-xs text-gray-600">{item.total} stron</p>
                      </div>
                    ))}
                  </div>
                  {d.avgMedicalTrustScore < 50 && (
                    <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-xs text-red-300">
                      ⚠️ Niski Medical Trust Score. Zalecane działania: dodaj autorów do artykułów medycznych, wdróż schema MedicalWebPage, dodaj disclaimery medyczne i aktualizuj daty artykułów.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* LOCAL SEO TAB */}
        {tab === 'local' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Local SEO</h2>
            {domainStats.map(d => {
              const domainPages = pages.filter(p => p.domain === d.domain);
              return (
                <div key={d.domain} className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-blue-300">{d.domain}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Local SEO Score</span>
                      <ScoreBadge score={(d as any).avgLocalSeoScore || 0} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {[
                      { label: 'Strony z telefonem', v: domainPages.filter(p => p.hasPhone).length },
                      { label: 'LocalBusiness/Clinic', v: d.localBusinessCount },
                      { label: 'Strony z CTA', v: d.ctaCount },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-800 rounded-lg p-3">
                        <p className="text-2xl font-bold">{item.v}</p>
                        <p className="text-xs text-gray-400">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* RECOMMENDATIONS TAB */}
        {tab === 'recommendations' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Rekomendacje SEO</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['critical', 'high', 'medium', 'low'] as const).map(p => (
                <div key={p} className="card-sm text-center">
                  <p className="text-2xl font-bold">{recommendations.filter(r => r.priority === p).length}</p>
                  <PriorityBadge priority={p} />
                </div>
              ))}
            </div>
            {(['critical', 'high', 'medium', 'low'] as const).map(prio => {
              const group = recommendations.filter(r => r.priority === prio);
              if (!group.length) return null;
              return (
                <div key={prio} className="space-y-2">
                  <h3 className="font-semibold text-gray-300 flex items-center gap-2">
                    <PriorityBadge priority={prio} /> {group.length} rekomendacji
                  </h3>
                  <div className="space-y-2">
                    {group.slice(0, 20).map(r => (
                      <div key={r.id} className={`priority-${prio} rounded-lg p-4`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{r.title}</p>
                            {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate block">{r.url}</a>}
                            {r.description && <p className="text-xs text-gray-400 mt-1">{r.description}</p>}
                            {r.action && <p className="text-xs text-gray-300 mt-1 font-medium">→ {r.action}</p>}
                          </div>
                          <div className="text-right shrink-0 text-xs text-gray-500">
                            <p>Wpływ: {r.seoImpact}</p>
                            <p>Trudność: {r.difficulty}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {group.length > 20 && <p className="text-xs text-gray-500 text-center">+ {group.length - 20} więcej w eksporcie XLSX</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* EXPORT TAB */}
        {tab === 'export' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Eksport danych</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="card space-y-3">
                <h3 className="font-semibold flex items-center gap-2">📊 Eksport XLSX</h3>
                <p className="text-sm text-gray-400">Plik Excel z arkuszami: Overview, Pages, Recommendations</p>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  <li>• Arkusz Overview: statystyki domen</li>
                  <li>• Arkusz Pages: wszystkie podstrony z metrykami</li>
                  <li>• Arkusz Recommendations: lista rekomendacji SEO</li>
                </ul>
                <a href={`/api/projects/${params.id}/export?format=xlsx`} download className="btn btn-success w-full justify-center">
                  ⬇️ Pobierz XLSX
                </a>
              </div>
              <div className="card space-y-3">
                <h3 className="font-semibold flex items-center gap-2">📄 Eksport CSV</h3>
                <p className="text-sm text-gray-400">Plik CSV z listą wszystkich podstron i kluczowymi metrykami SEO.</p>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  <li>• URL, domena, status HTTP</li>
                  <li>• Title, meta description, H1</li>
                  <li>• Scoring SEO (technical, on-page, overall)</li>
                </ul>
                <a href={`/api/projects/${params.id}/export?format=csv`} download className="btn btn-secondary w-full justify-center">
                  ⬇️ Pobierz CSV
                </a>
              </div>
            </div>
            <div className="card bg-gray-800/50">
              <h3 className="font-semibold mb-2">📋 Informacje o projekcie</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <p className="text-gray-400">ID projektu: <span className="text-gray-200 font-mono text-xs">{project.id}</span></p>
                <p className="text-gray-400">Status: <span className="text-gray-200">{project.status}</span></p>
                <p className="text-gray-400">Domeny: <span className="text-gray-200">{project.domains.join(', ')}</span></p>
                <p className="text-gray-400">Moja domena: <span className="text-gray-200">{project.myDomain || '—'}</span></p>
                <p className="text-gray-400">Łącznie stron: <span className="text-gray-200">{domainStats.reduce((s, d) => s + d.totalPages, 0)}</span></p>
                <p className="text-gray-400">Rekomendacji: <span className="text-gray-200">{recommendations.length}</span></p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function statusLabel(s: string) {
  const labels: Record<string, string> = {
    pending: 'Oczekuje', fetching_sitemap: 'Pobieranie sitemapy', crawling: 'Crawlowanie',
    analyzing: 'Analiza HTML', done: 'Gotowe', error: 'Błąd',
  };
  return labels[s] || s;
}
