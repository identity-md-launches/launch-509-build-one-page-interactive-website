import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyFilters, buildGraph, computeStats, countByCategory } from './lib/analyze';
import { ActivityError, fetchActivity, resolveInputKind, type FetchProgress } from './lib/blockscout';
import { formatCount, pluralize, shortAddress } from './lib/format';
import { DEFAULT_FILTERS, type ActivityResult, type Filters } from './lib/types';
import { AddressForm } from './components/AddressForm';
import { AnnouncerProvider, useAnnounce } from './components/Announcer';
import { Constellation } from './components/Constellation';
import { CounterpartyTable } from './components/CounterpartyTable';
import { FilterBar } from './components/FilterBar';
import { NodeDetails } from './components/NodeDetails';
import { StatsGrid } from './components/StatsGrid';

type Status =
  | { state: 'idle' }
  | { state: 'loading'; query: string; progress: FetchProgress | null }
  | { state: 'success'; query: string; result: ActivityResult }
  | { state: 'error'; query: string; message: string; code: ActivityError['code'] };

const SAMPLE_QUERY = 'sample';

function progressText(progress: FetchProgress | null): string {
  if (!progress) return 'Starting…';
  switch (progress.stage) {
    case 'resolving':
      return 'Resolving ENS name…';
    case 'wallet':
      return 'Looking up the address…';
    case 'transactions':
      return `Fetching transactions (page ${progress.page} of ${progress.totalPages})…`;
    case 'token-transfers':
      return `Fetching token transfers (page ${progress.page} of ${progress.totalPages})…`;
  }
}

function readHash(): string {
  const raw = decodeURIComponent(window.location.hash.replace(/^#\/?/, '')).trim();
  return raw;
}

export function App() {
  return (
    <AnnouncerProvider>
      <WalletConstellation />
    </AnnouncerProvider>
  );
}

function WalletConstellation() {
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialQuery, setInitialQuery] = useState('');
  const controller = useRef<AbortController | null>(null);
  const lastHashQuery = useRef<string | null>(null);
  const announce = useAnnounce();
  const resultsRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (query: string) => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setSelectedId(null);
      setFilters(DEFAULT_FILTERS);
      setStatus({ state: 'loading', query, progress: null });

      try {
        let result: ActivityResult;
        if (query === SAMPLE_QUERY) {
          const module = await import('./data/sample.json');
          result = module.default as ActivityResult;
        } else {
          result = await fetchActivity(query, {
            signal: current.signal,
            onProgress: (progress) => {
              if (!current.signal.aborted) setStatus({ state: 'loading', query, progress });
            },
          });
        }
        if (current.signal.aborted) return;
        setStatus({ state: 'success', query, result });
        const name = result.wallet.ensName ?? shortAddress(result.wallet.display);
        const transactions = new Set(result.interactions.map((i) => i.txHash)).size;
        announce(
          result.interactions.length === 0
            ? `No recent activity found for ${name}.`
            : `Loaded ${pluralize(transactions, 'transaction')} and ${pluralize(result.interactions.length, 'interaction')} for ${name}.`,
        );
      } catch (error) {
        if (current.signal.aborted) return;
        const activityError =
          error instanceof ActivityError
            ? error
            : new ActivityError('upstream', 'Something went wrong while loading the activity. Try again.');
        if (activityError.code === 'aborted') return;
        setStatus({ state: 'error', query, message: activityError.message, code: activityError.code });
      }
    },
    [announce],
  );

  // Hash routing: #<address|ens|sample> makes a map shareable and reloadable.
  useEffect(() => {
    const syncFromHash = () => {
      const query = readHash();
      if (!query) return;
      if (query !== SAMPLE_QUERY && resolveInputKind(query) === 'invalid') return;
      // The hash can report the same value twice (initial load plus a late
      // hashchange); only start one request per distinct query.
      if (lastHashQuery.current === query) return;
      lastHashQuery.current = query;
      setInitialQuery(query === SAMPLE_QUERY ? '' : query);
      void load(query);
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [load]);

  const navigate = (query: string) => {
    const next = `#${encodeURIComponent(query)}`;
    if (readHash() === query) {
      // Same query again: refresh without waiting for a hashchange.
      lastHashQuery.current = query;
      void load(query);
    } else {
      window.location.hash = next;
    }
  };

  const result = status.state === 'success' ? status.result : null;
  const filtered = useMemo(() => (result ? applyFilters(result.interactions, filters) : []), [result, filters]);
  const graph = useMemo(() => buildGraph(filtered), [filtered]);
  const fullGraph = useMemo(() => (result ? buildGraph(result.interactions) : null), [result]);
  const stats = useMemo(() => (result ? computeStats(filtered) : null), [result, filtered]);
  const counts = useMemo(() => (result ? countByCategory(result.interactions) : { outgoing: 0, incoming: 0, contracts: 0 }), [result]);

  const selectedNode = selectedId ? graph.nodes.find((n) => n.id === selectedId) ?? null : null;
  const selectedInteractions = useMemo(
    () => (selectedId ? filtered.filter((i) => i.counterparty === selectedId && i.direction !== 'self') : []),
    [filtered, selectedId],
  );

  // Drop a selection that the filters removed from the map.
  useEffect(() => {
    if (selectedId && !graph.nodes.some((n) => n.id === selectedId)) setSelectedId(null);
  }, [graph.nodes, selectedId]);

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      const node = graph.nodes.find((n) => n.id === id);
      if (node) announce(`Selected ${node.label ?? shortAddress(node.display)}.`);
    }
  };

  const loading = status.state === 'loading';

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="starfield" aria-hidden="true" />
      <header className="site-header">
        <div className="site-header__brand">
          <span className="site-header__mark" aria-hidden="true" />
          <span className="site-header__name">Wallet Constellation</span>
        </div>
        <a className="text-link site-header__link" href="https://eth.blockscout.com" target="_blank" rel="noopener noreferrer">
          Data from Blockscout
        </a>
      </header>

      <main id="main" className="page">
        <section className="hero" aria-labelledby="hero-heading">
          <h1 id="hero-heading" className="hero__title">
            Map an address as a star map
          </h1>
          <p className="hero__lead">
            Enter any Ethereum address and see its recent counterparties as stars. Bigger stars interact more often,
            lines show transfers and contract calls.
          </p>
          <AddressForm
            initialValue={initialQuery}
            loading={loading}
            loadingText={status.state === 'loading' ? progressText(status.progress) : null}
            onSubmit={navigate}
            onSample={() => navigate(SAMPLE_QUERY)}
          />
        </section>

        {status.state === 'error' ? (
          <div className="banner banner--error" role="alert">
            <p className="banner__title">Unable to load activity</p>
            <p>{status.message}</p>
            {status.code !== 'invalid-input' && status.code !== 'ens-not-found' ? (
              <button type="button" className="button button--ghost button--small" onClick={() => void load(status.query)}>
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        {status.state === 'loading' || result ? (
          <div className="results" ref={resultsRef}>
            <StatsGrid stats={stats} loading={loading} unfilteredCount={result ? result.interactions.length : null} />

            {result ? (
              <>
                <FilterBar filters={filters} counts={counts} onChange={setFilters} />
                <div className="map-layout">
                  <section className="map-panel" aria-labelledby="map-heading">
                    <h2 id="map-heading" className="visually-hidden">
                      Constellation map
                    </h2>
                    <Constellation
                      wallet={result.wallet}
                      graph={graph}
                      selectedId={selectedId}
                      onSelect={handleSelect}
                      onShowEverything={() => setFilters(DEFAULT_FILTERS)}
                      totalNodes={fullGraph?.nodes.length ?? 0}
                    />
                  </section>
                  <aside className="side-panel" aria-label="Details">
                    <NodeDetails
                      wallet={result.wallet}
                      node={selectedNode}
                      interactions={selectedInteractions}
                      walletTotals={{ interactions: filtered.length, counterparties: graph.nodes.length }}
                      onClear={() => setSelectedId(null)}
                    />
                  </aside>
                </div>
                <CounterpartyTable nodes={graph.nodes} selectedId={selectedId} onSelect={handleSelect} />
                <p className="source-note">
                  {result.source.name}: {formatCount(result.interactions.length)} most recent interactions (
                  {result.source.transactionPages} transaction {result.source.transactionPages === 1 ? 'page' : 'pages'},{' '}
                  {result.source.tokenTransferPages} token-transfer {result.source.tokenTransferPages === 1 ? 'page' : 'pages'})
                  {result.source.truncated ? '. Older history is not included.' : '.'} Internal (contract-to-contract) calls are not
                  shown.
                </p>
              </>
            ) : (
              <div className="map-skeleton" aria-hidden="true">
                <span className="skeleton skeleton--map" />
              </div>
            )}
          </div>
        ) : null}

        {status.state === 'idle' ? (
          <section className="intro" aria-labelledby="intro-heading">
            <h2 id="intro-heading" className="intro__title">
              How it reads the sky
            </h2>
            <ul className="intro__list">
              <li>
                <strong>Stars</strong> are addresses and contracts this wallet touched recently. The busiest sit closest to
                the centre and grow with every interaction.
              </li>
              <li>
                <strong>Lines</strong> are transfers and contract calls, coloured by direction. Dashed lines lead to
                contracts.
              </li>
              <li>
                <strong>Filters</strong> narrow the map to outgoing, incoming or contract activity without leaving the page.
              </li>
            </ul>
          </section>
        ) : null}
      </main>

      <footer className="site-footer">
        <p>
          Wallet Constellation reads public mainnet data only. It never asks for private keys, signatures or a wallet
          connection.
        </p>
      </footer>
    </>
  );
}
