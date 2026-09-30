import { useState } from 'react';
import type { GraphNode } from '../lib/analyze';
import { formatCount, formatDate, pluralize, shortAddress } from '../lib/format';
import { CopyButton } from './CopyButton';
import { nodeName } from './Constellation';

interface CounterpartyTableProps {
  nodes: GraphNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const INITIAL_ROWS = 10;

export function CounterpartyTable({ nodes, selectedId, onSelect }: CounterpartyTableProps) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? nodes : nodes.slice(0, INITIAL_ROWS);
  const hiddenCount = nodes.length - rows.length;

  if (nodes.length === 0) return null;

  return (
    <section className="counterparties" aria-labelledby="counterparties-heading">
      <div className="section-heading">
        <h2 id="counterparties-heading">Counterparties</h2>
        <p className="section-heading__note">{pluralize(nodes.length, 'star')} in view, busiest first.</p>
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Counterparty</th>
              <th scope="col">Type</th>
              <th scope="col" className="num">
                Sent
              </th>
              <th scope="col" className="num">
                Received
              </th>
              <th scope="col">Last seen</th>
              <th scope="col">
                <span className="visually-hidden">Copy address</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((node) => {
              const selected = node.id === selectedId;
              return (
                <tr key={node.id} className={selected ? 'table__row--selected' : undefined} aria-selected={selected}>
                  <th scope="row">
                    <button type="button" className="row-button" onClick={() => onSelect(node.id)} aria-pressed={selected}>
                      <span className="row-button__name">{nodeName(node)}</span>
                      {node.label ? <span className="row-button__address mono">{shortAddress(node.display)}</span> : null}
                    </button>
                  </th>
                  <td>
                    <span className={`badge ${node.isContract ? 'badge--contract' : 'badge--wallet'}`}>
                      {node.isContract ? 'Contract' : 'Wallet'}
                    </span>
                  </td>
                  <td className="num">{formatCount(node.outgoing)}</td>
                  <td className="num">{formatCount(node.incoming)}</td>
                  <td>{formatDate(node.lastSeen)}</td>
                  <td className="table__actions">
                    <CopyButton value={node.display} what="address" iconOnly />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {nodes.length > INITIAL_ROWS ? (
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? 'Show fewer counterparties' : `Show all ${formatCount(nodes.length)} counterparties`}
          {!expanded && hiddenCount > 0 ? '' : ''}
        </button>
      ) : null}
    </section>
  );
}
