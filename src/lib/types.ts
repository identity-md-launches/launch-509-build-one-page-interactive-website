/** Normalised activity model shared by the fetcher, the analysis and the UI. */

export type Direction = 'in' | 'out' | 'self';

export type InteractionKind = 'transaction' | 'token-transfer';

export interface TokenMovement {
  symbol: string;
  name: string;
  /** Raw integer amount as a decimal string (may be "0" for NFTs). */
  amount: string;
  decimals: number;
  /** ERC-20, ERC-721, ERC-1155 … */
  standard: string;
}

export interface Interaction {
  /** Unique id: tx hash, or tx hash + log index for token transfers. */
  id: string;
  txHash: string;
  kind: InteractionKind;
  direction: Direction;
  /** Lower-cased counterparty address; null when the counterparty is unknown. */
  counterparty: string | null;
  /** Checksummed display form of the counterparty. */
  counterpartyDisplay: string | null;
  counterpartyIsContract: boolean;
  /** ENS name, public tag or verified contract name, if any. */
  counterpartyLabel: string | null;
  /** Unix epoch milliseconds. */
  timestamp: number;
  /** Native value in wei as a decimal string ("0" for token transfers). */
  valueWei: string;
  /** Decoded method name for contract calls, when known. */
  method: string | null;
  status: 'ok' | 'error' | 'pending';
  blockNumber: number | null;
  token: TokenMovement | null;
}

export interface WalletInfo {
  /** Lower-cased address. */
  address: string;
  /** Checksummed display form. */
  display: string;
  ensName: string | null;
  label: string | null;
  isContract: boolean;
}

export interface ActivityResult {
  wallet: WalletInfo;
  interactions: Interaction[];
  /** How the data was gathered, for the UI footnote. */
  source: {
    name: string;
    transactionPages: number;
    tokenTransferPages: number;
    truncated: boolean;
    fetchedAt: number;
  };
}

export interface Filters {
  outgoing: boolean;
  incoming: boolean;
  contracts: boolean;
}

export const DEFAULT_FILTERS: Filters = { outgoing: true, incoming: true, contracts: true };
