import type { GraphNode } from '../lib/analyze';
import { explorerAddressUrl, explorerTxUrl } from '../lib/blockscout';
import { formatCount, formatDate, formatDateTime, formatEth, formatTokenAmount, pluralize, shortAddress } from '../lib/format';
import type { Interaction, WalletInfo } from '../lib/types';
import { CopyButton } from './CopyButton';
import { nodeName } from './Constellation';

interface NodeDetailsProps {
  wallet: WalletInfo;
  node: GraphNode | null;
  /** Interactions for the selected node (already filtered). */
  interactions: Interaction[];
  walletTotals: { interactions: number; counterparties: number };
  onClear: () => void;
}

const LIST_LIMIT = 8;

export function NodeDetails({ wallet, node, interactions, walletTotals, onClear }: NodeDetailsProps) {
  if (!node) {
    const name = wallet.ensName ?? wallet.label ?? shortAddress(wallet.display);
    return (
      <section className="details" aria-labelledby="details-heading">
        <p className="details__eyebrow">Centre star</p>
        <h2 id="details-heading" className="details__title">
          {name}
        </h2>
        <AddressRow address={wallet.display} />
        <dl className="details__facts">
          <div>
            <dt>Type</dt>
            <dd>{wallet.isContract ? 'Contract' : 'Wallet'}</dd>
          </div>
          <div>
            <dt>Interactions in view</dt>
            <dd>{formatCount(walletTotals.interactions)}</dd>
          </div>
          <div>
            <dt>Counterparties in view</dt>
            <dd>{formatCount(walletTotals.counterparties)}</dd>
          </div>
        </dl>
        <p className="details__help">Select a star on the map or in the list to see who it is and what moved.</p>
        <a className="text-link text-link--block" href={explorerAddressUrl(wallet.display)} target="_blank" rel="noopener noreferrer">
          View {name} on Blockscout
        </a>
      </section>
    );
  }

  const shown = interactions.slice(0, LIST_LIMIT);
  const remaining = interactions.length - shown.length;
  const name = nodeName(node);

  return (
    <section className="details" aria-labelledby="details-heading">
      <div className="details__header">
        <div>
          <p className="details__eyebrow">{node.isContract ? 'Contract' : 'Wallet'}</p>
          <h2 id="details-heading" className="details__title">
            {name}
          </h2>
        </div>
        <button type="button" className="button button--ghost button--small" onClick={onClear}>
          Clear selection
        </button>
      </div>
      <AddressRow address={node.display} />
      <dl className="details__facts">
        <div>
          <dt>Sent to it</dt>
          <dd className="tone-outgoing">{formatCount(node.outgoing)}</dd>
        </div>
        <div>
          <dt>Received from it</dt>
          <dd className="tone-incoming">{formatCount(node.incoming)}</dd>
        </div>
        <div>
          <dt>Contract calls</dt>
          <dd className="tone-contract">{formatCount(node.contractCalls)}</dd>
        </div>
        <div>
          <dt>Token transfers</dt>
          <dd>{formatCount(node.tokenTransfers)}</dd>
        </div>
        <div>
          <dt>First seen</dt>
          <dd>{formatDate(node.firstSeen)}</dd>
        </div>
        <div>
          <dt>Last seen</dt>
          <dd>{formatDate(node.lastSeen)}</dd>
        </div>
      </dl>
      {node.tokens.length > 0 ? (
        <p className="details__tokens">
          <span className="details__tokens-label">Tokens moved:</span> {node.tokens.slice(0, 8).join(', ')}
          {node.tokens.length > 8 ? ` and ${node.tokens.length - 8} more` : ''}
        </p>
      ) : null}

      <h3 className="details__subheading">Recent interactions</h3>
      <ol className="tx-list">
        {shown.map((item) => (
          <li key={item.id} className="tx">
            <div className="tx__row">
              <span className={`tx__direction tone-${item.direction === 'in' ? 'incoming' : 'outgoing'}`}>
                {item.direction === 'in' ? 'Received' : item.direction === 'self' ? 'Self transfer' : 'Sent'}
              </span>
              <time className="tx__time" dateTime={new Date(item.timestamp).toISOString()}>
                {formatDateTime(item.timestamp)}
              </time>
            </div>
            <div className="tx__row">
              <span className="tx__amount">{describeAmount(item)}</span>
              {item.status === 'error' ? <span className="badge badge--danger">Failed</span> : null}
            </div>
            <div className="tx__row tx__row--hash">
              <a className="text-link text-link--block mono" href={explorerTxUrl(item.txHash)} target="_blank" rel="noopener noreferrer">
                {shortAddress(item.txHash, 10, 6)}
              </a>
              <CopyButton value={item.txHash} what="transaction hash" iconOnly />
            </div>
          </li>
        ))}
      </ol>
      {remaining > 0 ? (
        <p className="details__help">
          Showing the latest {LIST_LIMIT} of {pluralize(interactions.length, 'interaction')}. The full history is on
          Blockscout.
        </p>
      ) : null}
      <a className="text-link text-link--block" href={explorerAddressUrl(node.display)} target="_blank" rel="noopener noreferrer">
        View {name} on Blockscout
      </a>
    </section>
  );
}

function AddressRow({ address }: { address: string }) {
  return (
    <div className="address-row">
      <code className="address-row__value mono" title={address}>
        {address}
      </code>
      <CopyButton value={address} what="address" />
    </div>
  );
}

export function describeAmount(item: Interaction): string {
  if (item.token) {
    const amount =
      item.token.standard === 'ERC-721'
        ? `1 ${item.token.symbol}`
        : formatTokenAmount(item.token.amount, item.token.decimals, item.token.symbol);
    return item.method ? `${amount} · ${item.method}` : amount;
  }
  const value = formatEth(item.valueWei);
  if (item.method && item.method !== 'transfer') return `${value} · ${item.method}`;
  return value;
}
