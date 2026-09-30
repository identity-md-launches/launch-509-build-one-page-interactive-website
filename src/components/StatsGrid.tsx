import type { Stats } from '../lib/analyze';
import { formatCount, formatDate, formatDayKey, pluralize } from '../lib/format';

interface StatsGridProps {
  stats: Stats | null;
  loading: boolean;
  /** Total interactions before filters, so the grid can say what is hidden. */
  unfilteredCount: number | null;
}

export function StatsGrid({ stats, loading, unfilteredCount }: StatsGridProps) {
  const hidden = stats && unfilteredCount !== null ? unfilteredCount - stats.interactions : 0;

  const tiles = [
    {
      key: 'transactions',
      label: 'Recent transactions',
      value: stats ? formatCount(stats.transactions) : '—',
      detail: stats
        ? stats.earliest !== null && stats.latest !== null
          ? `${formatDate(stats.earliest)} – ${formatDate(stats.latest)}`
          : 'No dated activity'
        : 'Unique transaction hashes',
    },
    {
      key: 'counterparties',
      label: 'Unique counterparties',
      value: stats ? formatCount(stats.uniqueCounterparties) : '—',
      detail: 'Addresses and contracts on the map',
    },
    {
      key: 'contracts',
      label: 'Contract interactions',
      value: stats ? formatCount(stats.contractInteractions) : '—',
      detail: 'Calls and transfers involving contracts',
    },
    {
      key: 'day',
      label: 'Most active day',
      value: stats?.mostActiveDay ? formatDayKey(stats.mostActiveDay.day) : '—',
      detail: stats?.mostActiveDay ? `${pluralize(stats.mostActiveDay.count, 'interaction')} (UTC)` : 'By interaction count',
    },
  ];

  return (
    <section className="stats" aria-labelledby="stats-heading">
      <div className="section-heading">
        <h2 id="stats-heading">Activity summary</h2>
        {hidden > 0 ? (
          <p className="section-heading__note">
            Filters hide {pluralize(hidden, 'interaction')} of {formatCount(unfilteredCount ?? 0)}.
          </p>
        ) : null}
      </div>
      <dl className={`stats__grid ${loading ? 'stats__grid--loading' : ''}`}>
        {tiles.map((tile) => (
          <div className="stat" key={tile.key}>
            <dt className="stat__label">{tile.label}</dt>
            <dd className="stat__value">
              {loading ? <span className="skeleton skeleton--value" aria-hidden="true" /> : tile.value}
              {loading && <span className="visually-hidden">Loading</span>}
            </dd>
            <dd className="stat__detail">{tile.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
