/**
 * Read-only client for the public Blockscout Ethereum mainnet API (v2).
 * No API key, no wallet, no signatures: only public chain data is read.
 */
import { isAddress, isEnsName } from './format';
import type { ActivityResult, Interaction, TokenMovement, WalletInfo } from './types';

export const BLOCKSCOUT_BASE = 'https://eth.blockscout.com';
const API = `${BLOCKSCOUT_BASE}/api/v2`;

export const MAX_TRANSACTION_PAGES = 4;
export const MAX_TOKEN_TRANSFER_PAGES = 2;
const REQUEST_TIMEOUT_MS = 20_000;

export type ActivityErrorCode =
  | 'invalid-input'
  | 'ens-not-found'
  | 'rate-limited'
  | 'network'
  | 'upstream'
  | 'aborted';

export class ActivityError extends Error {
  readonly code: ActivityErrorCode;

  constructor(code: ActivityErrorCode, message: string) {
    super(message);
    this.name = 'ActivityError';
    this.code = code;
  }
}

export interface FetchProgress {
  stage: 'resolving' | 'wallet' | 'transactions' | 'token-transfers';
  page?: number;
  totalPages?: number;
}

export interface FetchOptions {
  signal?: AbortSignal;
  onProgress?: (progress: FetchProgress) => void;
  fetchImpl?: typeof fetch;
  maxTransactionPages?: number;
  maxTokenTransferPages?: number;
}

// --- Raw Blockscout shapes (only the fields we read) ---------------------

interface RawAddressRef {
  hash: string;
  is_contract?: boolean | null;
  ens_domain_name?: string | null;
  name?: string | null;
  metadata?: { tags?: { name?: string; tagType?: string }[] | null } | null;
}

interface RawTransaction {
  hash: string;
  from: RawAddressRef | null;
  to: RawAddressRef | null;
  created_contract?: RawAddressRef | null;
  value: string;
  timestamp: string | null;
  method: string | null;
  status: string | null;
  result?: string | null;
  block_number: number | null;
}

interface RawTokenTransfer {
  transaction_hash: string;
  log_index?: number | string | null;
  from: RawAddressRef | null;
  to: RawAddressRef | null;
  timestamp: string | null;
  block_number: number | null;
  method?: string | null;
  token: { symbol?: string | null; name?: string | null; decimals?: string | null; type?: string | null } | null;
  total: { value?: string | null; decimals?: string | null; token_id?: string | null } | null;
}

interface RawPage<T> {
  items: T[];
  next_page_params: Record<string, string | number> | null;
}

// --- Public API ------------------------------------------------------------

export function resolveInputKind(value: string): 'address' | 'ens' | 'invalid' {
  const trimmed = value.trim();
  if (isAddress(trimmed)) return 'address';
  if (isEnsName(trimmed)) return 'ens';
  return 'invalid';
}

export async function fetchActivity(query: string, options: FetchOptions = {}): Promise<ActivityResult> {
  const { signal, onProgress } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxTxPages = options.maxTransactionPages ?? MAX_TRANSACTION_PAGES;
  const maxTokenPages = options.maxTokenTransferPages ?? MAX_TOKEN_TRANSFER_PAGES;
  const trimmed = query.trim();
  const kind = resolveInputKind(trimmed);
  if (kind === 'invalid') {
    throw new ActivityError(
      'invalid-input',
      'Enter a 42-character address that starts with 0x, or an ENS name that ends in .eth.',
    );
  }

  let address = trimmed.toLowerCase();
  let ensName: string | null = null;
  if (kind === 'ens') {
    onProgress?.({ stage: 'resolving' });
    address = await resolveEns(trimmed, fetchImpl, signal);
    ensName = trimmed.toLowerCase();
  }

  onProgress?.({ stage: 'wallet' });
  const info = await getJson<RawAddressRef>(`${API}/addresses/${address}`, fetchImpl, signal);
  const wallet: WalletInfo = {
    address,
    display: info.hash || address,
    ensName: info.ens_domain_name ?? ensName,
    label: labelFor(info),
    isContract: Boolean(info.is_contract),
  };

  const interactions: Interaction[] = [];
  const seen = new Set<string>();

  let txPages = 0;
  let txTruncated = false;
  let next: Record<string, string | number> | null = null;
  for (let page = 1; page <= maxTxPages; page += 1) {
    onProgress?.({ stage: 'transactions', page, totalPages: maxTxPages });
    const url = withParams(`${API}/addresses/${address}/transactions`, next);
    const data = await getJson<RawPage<RawTransaction>>(url, fetchImpl, signal);
    txPages += 1;
    for (const raw of data.items ?? []) {
      const item = normaliseTransaction(raw, address);
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        interactions.push(item);
      }
    }
    next = data.next_page_params;
    if (!next) break;
    if (page === maxTxPages) txTruncated = true;
  }

  let tokenPages = 0;
  let tokenTruncated = false;
  next = null;
  for (let page = 1; page <= maxTokenPages; page += 1) {
    onProgress?.({ stage: 'token-transfers', page, totalPages: maxTokenPages });
    const url = withParams(`${API}/addresses/${address}/token-transfers`, next);
    const data = await getJson<RawPage<RawTokenTransfer>>(url, fetchImpl, signal);
    tokenPages += 1;
    for (const raw of data.items ?? []) {
      const item = normaliseTokenTransfer(raw, address);
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        interactions.push(item);
      }
    }
    next = data.next_page_params;
    if (!next) break;
    if (page === maxTokenPages) tokenTruncated = true;
  }

  interactions.sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id));

  return {
    wallet,
    interactions,
    source: {
      name: 'Blockscout',
      transactionPages: txPages,
      tokenTransferPages: tokenPages,
      truncated: txTruncated || tokenTruncated,
      fetchedAt: Date.now(),
    },
  };
}

export function explorerAddressUrl(address: string): string {
  return `${BLOCKSCOUT_BASE}/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `${BLOCKSCOUT_BASE}/tx/${hash}`;
}

// --- Normalisation ---------------------------------------------------------

export function normaliseTransaction(raw: RawTransaction, wallet: string): Interaction | null {
  if (!raw.hash || !raw.timestamp) return null; // skip pending entries
  const timestamp = Date.parse(raw.timestamp);
  if (Number.isNaN(timestamp)) return null;
  const from = raw.from?.hash?.toLowerCase() ?? null;
  const toRef = raw.to ?? raw.created_contract ?? null;
  const to = toRef?.hash?.toLowerCase() ?? null;

  let direction: Interaction['direction'];
  let counterpartyRef: RawAddressRef | null;
  if (from === wallet && to === wallet) {
    direction = 'self';
    counterpartyRef = raw.to;
  } else if (from === wallet) {
    direction = 'out';
    counterpartyRef = toRef;
  } else {
    direction = 'in';
    counterpartyRef = raw.from;
  }

  const isCreation = !raw.to && Boolean(raw.created_contract);
  return {
    id: raw.hash.toLowerCase(),
    txHash: raw.hash.toLowerCase(),
    kind: 'transaction',
    direction,
    counterparty: counterpartyRef?.hash ? counterpartyRef.hash.toLowerCase() : null,
    counterpartyDisplay: counterpartyRef?.hash ?? null,
    counterpartyIsContract: Boolean(counterpartyRef?.is_contract) || isCreation,
    counterpartyLabel: counterpartyRef ? labelFor(counterpartyRef) : null,
    timestamp,
    valueWei: raw.value ?? '0',
    method: raw.method ?? (isCreation ? 'contract creation' : null),
    status: raw.status === 'ok' ? 'ok' : raw.status === 'error' ? 'error' : 'pending',
    blockNumber: raw.block_number,
    token: null,
  };
}

export function normaliseTokenTransfer(raw: RawTokenTransfer, wallet: string): Interaction | null {
  if (!raw.transaction_hash || !raw.timestamp) return null;
  const timestamp = Date.parse(raw.timestamp);
  if (Number.isNaN(timestamp)) return null;
  const from = raw.from?.hash?.toLowerCase() ?? null;
  const to = raw.to?.hash?.toLowerCase() ?? null;

  let direction: Interaction['direction'];
  let counterpartyRef: RawAddressRef | null;
  if (from === wallet && to === wallet) {
    direction = 'self';
    counterpartyRef = raw.to;
  } else if (from === wallet) {
    direction = 'out';
    counterpartyRef = raw.to;
  } else if (to === wallet) {
    direction = 'in';
    counterpartyRef = raw.from;
  } else {
    // Transfer routed through the wallet as operator: attribute to the sender.
    direction = 'in';
    counterpartyRef = raw.from;
  }

  const decimals = Number(raw.token?.decimals ?? raw.total?.decimals ?? '0');
  const token: TokenMovement = {
    symbol: raw.token?.symbol || shortSymbol(raw.token?.name) || 'TOKEN',
    name: raw.token?.name || 'Unknown token',
    amount: raw.total?.value ?? (raw.total?.token_id ? '1' : '0'),
    decimals: Number.isFinite(decimals) ? decimals : 0,
    standard: raw.token?.type || 'token',
  };

  const logIndex = raw.log_index ?? 'x';
  return {
    id: `${raw.transaction_hash.toLowerCase()}:${logIndex}`,
    txHash: raw.transaction_hash.toLowerCase(),
    kind: 'token-transfer',
    direction,
    counterparty: counterpartyRef?.hash ? counterpartyRef.hash.toLowerCase() : null,
    counterpartyDisplay: counterpartyRef?.hash ?? null,
    counterpartyIsContract: Boolean(counterpartyRef?.is_contract),
    counterpartyLabel: counterpartyRef ? labelFor(counterpartyRef) : null,
    timestamp,
    valueWei: '0',
    method: raw.method && !raw.method.startsWith('0x') ? raw.method : null,
    status: 'ok',
    blockNumber: raw.block_number,
    token,
  };
}

function labelFor(ref: RawAddressRef): string | null {
  if (ref.ens_domain_name) return ref.ens_domain_name;
  const tags = ref.metadata?.tags ?? [];
  const named = tags.find((t) => t.tagType === 'name' && t.name);
  if (named?.name) return named.name;
  if (ref.name) return ref.name;
  return null;
}

function shortSymbol(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}

// --- HTTP helpers ------------------------------------------------------------

async function resolveEns(name: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<string> {
  const data = await getJson<{ items?: { address_hash?: string; ens_info?: { name?: string } }[] }>(
    `${API}/search?q=${encodeURIComponent(name)}`,
    fetchImpl,
    signal,
  );
  const wanted = name.toLowerCase();
  const match = (data.items ?? []).find(
    (item) => item.ens_info?.name?.toLowerCase() === wanted && item.address_hash,
  );
  if (!match?.address_hash) {
    throw new ActivityError(
      'ens-not-found',
      `No ENS record found for "${name}". Check the spelling or enter the 0x address instead.`,
    );
  }
  return match.address_hash.toLowerCase();
}

function withParams(url: string, params: Record<string, string | number> | null): string {
  if (!params) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) search.set(key, String(value));
  return `${url}?${search.toString()}`;
}

async function getJson<T>(url: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    let response: Response;
    try {
      response = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    } catch (error) {
      if (signal?.aborted) throw new ActivityError('aborted', 'Request cancelled.');
      if (controller.signal.aborted) {
        throw new ActivityError('network', 'Blockscout took too long to respond. Try again in a moment.');
      }
      const networkError = new ActivityError(
        'network',
        'Unable to reach Blockscout. Check your connection and try again.',
      );
      networkError.cause = error;
      throw networkError;
    }
    if (response.status === 429) {
      throw new ActivityError('rate-limited', 'Blockscout is rate limiting requests. Wait a minute and try again.');
    }
    if (!response.ok) {
      throw new ActivityError('upstream', `Blockscout returned an error (HTTP ${response.status}). Try again later.`);
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ActivityError('upstream', 'Blockscout returned an unreadable response. Try again later.');
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
