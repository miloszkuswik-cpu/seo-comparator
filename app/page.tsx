'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const MODULES = [
  { id: 'technical', label: 'Analiza techniczna' },
  { id: 'onpage', label: 'On-page SEO' },
  { id: 'content', label: 'Analiza treści' },
  { id: 'links', label: 'Linkowanie wewnętrzne' },
  { id: 'images', label: 'Obrazy' },
  { id: 'schema', label: 'Schema.org' },
  { id: 'local', label: 'Lokalne SEO' },
  { id: 'medical', label: 'Medical SEO / E-E-A-T' },
  { id: 'cta', label: 'CTA / Konwersja' },
  { id: 'duplicates', label: 'Duplikacja i kanibalizacja' },
];

interface Project { id: string; name: string; domains: string[]; status: string; createdAt: string; }

export default function HomePage() {
  const [domainsText, setDomainsText] = useState('');
  const [maxPages, setMaxPages] = useState(50);
  const [myDomain, setMyDomain] = useState('');
  const [projectName, setProjectName] = useState('');
  const [modules, setModules] = useState<string[]>(MODULES.map(m => m.id));
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const res = await fetch('/api/projects');
    if (res.ok) setProjects(await res.json());
  };

  const handleModuleToggle = (id: string) => {
    setModules(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    const rawDomains = domainsText.split('\n').map(d => d.trim()).filter(Boolean);
    if (rawDomains.length === 0) { setError('Podaj co najmniej jedną domenę'); return; }
    if (maxPages < 1 || maxPages > 500) { setError('Limit podstron: 1-500'); return; }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName || undefined, domains: rawDomains, myDomain: myDomain || undefined, maxPages, modules }),
      });

      const data = await res.json();
      if (!data) return (<div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-4 text-center"><div className="text-5xl">⚠️</div><h1 className="text-xl font-semibold text-white">Nie znaleziono raportu</h1><p className="text-gray-400 text-sm max-w-md">Raport wygasł po restarcie serwera. Uruchom nową analizę.</p><Link href="/" className="mt-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium">← Wróć do strony głównej</Link></div>);

      const crawlRes = await fetch(`/api/projects/${data.id}/crawl`, { method: 'POST' });
      if (!crawlRes.ok) { setError('Błąd uruchamiania crawla'); setLoading(false); return; }

      window.location.href = `/report/${data.id}`;
    } catch (e) {
      setError('Błąd połączenia z serwerem');
      setLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    idle: 'text-gray-400', running: 'text-yellow-400', done: 'text-green-400', error: 'text-red-400',
  };
  const statusLabel: Record<string, string> = {
    idle: 'Oczekuje', running: '⏳ W trakcie', done: '✅ Gotowe', error: '❌ Błąd',
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">S</div>
            <span className="font-semibold text-lg">SEO Comparator Pro</span>
          </div>
          <p className="text-xs text-gray-500">Wersja MVP • Lokalny crawler SEO</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* New Analysis Form */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Nowa analiza SEO</h1>
            <p className="text-gray-400 text-sm">Wpisz domeny do porównania i skonfiguruj parametry crawlu.</p>
          </div>

          <div className="card space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Nazwa projektu (opcjonalnie)</label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="np. Kliniki medyczne Warszawa 2024"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">Domeny / URL-e do analizy <span className="text-red-400">*</span></label>
              <textarea
                value={domainsText}
                onChange={e => setDomainsText(e.target.value)}
                placeholder={"mojadomena.pl\nkonkurencja1.pl\nkonkurencja2.pl"}
                rows={5}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono focus:border-blue-500 focus:outline-none resize-y"
              />
              <p className="text-xs text-gray-500 mt-1">Jedna domena lub URL na linię. Przykład: klinika.pl lub https://klinika.pl/uslugi</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Moja domena (do Content Gap)</label>
                <input
                  type="text"
                  value={myDomain}
                  onChange={e => setMyDomain(e.target.value)}
                  placeholder="mojadomena.pl"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Max podstron na domenę</label>
                <input
                  type="number"
                  min={1} max={500}
                  value={maxPages}
                  onChange={e => setMaxPages(parseInt(e.target.value) || 50)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3 text-gray-300">Moduły analizy</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MODULES.map(m => (
                  <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm transition-colors ${modules.includes(m.id) ? 'bg-blue-900/40 border border-blue-700 text-blue-200' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                    <input type="checkbox" checked={modules.includes(m.id)} onChange={() => handleModuleToggle(m.id)} className="accent-blue-500" />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-yellow-950 border border-yellow-800 rounded-lg p-3 text-xs text-yellow-300">
              ⚠️ <strong>Ważne:</strong> Użytkownik odpowiada za zgodność crawlowania z regulaminami i polityką robots.txt analizowanych stron. SEO Comparator Bot identyfikuje się jako <code>SEOComparatorBot/1.0</code>.
            </div>

            {error && <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-sm text-red-300">❌ {error}</div>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`btn btn-primary w-full justify-center text-base py-3 ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {loading ? '⏳ Uruchamianie...' : '🚀 Rozpocznij analizę'}
            </button>
          </div>
        </div>

        {/* Recent Projects */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Ostatnie projekty</h2>
          {projects.length === 0 ? (
            <div className="card text-center py-10 text-gray-500">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-sm">Brak projektów.<br />Utwórz pierwszą analizę.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 10).map(p => (
                <Link key={p.id} href={`/report/${p.id}`} className="card-sm block hover:border-gray-600 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <span className={`text-xs font-medium shrink-0 ${statusColor[p.status] || 'text-gray-400'}`}>
                      {statusLabel[p.status] || p.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{p.domains.join(', ')}</p>
                  <p className="text-xs text-gray-600 mt-1">{new Date(p.createdAt).toLocaleDateString('pl-PL')}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
