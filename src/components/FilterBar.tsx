import type { Filters } from '../lib/types';
import { formatCount } from '../lib/format';

interface FilterBarProps {
  filters: Filters;
  counts: { outgoing: number; incoming: number; contracts: number };
  onChange: (next: Filters) => void;
}

const OPTIONS: { key: keyof Filters; label: string; tone: 'outgoing' | 'incoming' | 'contract' }[] = [
  { key: 'outgoing', label: 'Outgoing', tone: 'outgoing' },
  { key: 'incoming', label: 'Incoming', tone: 'incoming' },
  { key: 'contracts', label: 'Contract interactions', tone: 'contract' },
];

export function FilterBar({ filters, counts, onChange }: FilterBarProps) {
  const allOn = filters.outgoing && filters.incoming && filters.contracts;
  return (
    <fieldset className="filters">
      <legend className="filters__legend">Show</legend>
      <div className="filters__options">
        {OPTIONS.map((option) => (
          <label key={option.key} className={`chip chip--${option.tone}`} data-checked={filters[option.key]}>
            <input
              type="checkbox"
              className="chip__input"
              checked={filters[option.key]}
              onChange={(event) => onChange({ ...filters, [option.key]: event.target.checked })}
            />
            <span className="chip__swatch" aria-hidden="true" />
            <span className="chip__label">{option.label}</span>
            <span className="chip__count">{formatCount(counts[option.key])}</span>
          </label>
        ))}
        {!allOn ? (
          <button
            type="button"
            className="button button--link"
            onClick={() => onChange({ outgoing: true, incoming: true, contracts: true })}
          >
            Show everything
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
