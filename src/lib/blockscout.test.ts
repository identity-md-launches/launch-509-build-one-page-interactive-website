import { describe, expect, it, vi } from 'vitest';
import { ActivityError, fetchActivity, normaliseTokenTransfer, normaliseTransaction } from './blockscout';

const WALLET = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('normaliseTransaction', () => {
  it('marks outgoing calls to contracts', () => {
    const item = normaliseTransaction(
      {
        hash: '0xABC',
        from: { hash: WALLET.toUpperCase().replace('0X', '0x') },
        to: { hash: OTHER, is_contract: true, name: 'Router', metadata: { tags: [{ name: 'Uniswap', tagType: 'name' }] } },
        value: '5',
        timestamp: '2026-09-29T10:00:00.000000Z',
        method: 'swap',
        status: 'ok',
        block_number: 10,
      },
      WALLET,
    );
    expect(item).toMatchObject({
      id: '0xabc',
      direction: 'out',
      counterparty: OTHER,
      counterpartyIsContract: true,
      counterpartyLabel: 'Uniswap',
      method: 'swap',
      status: 'ok',
    });
  });

  it('marks incoming transfers from wallets and skips pending entries', () => {
    const item = normaliseTransaction(
      { hash: '0x1', from: { hash: OTHER }, to: { hash: WALLET }, value: '1', timestamp: '2026-09-29T10:00:00Z', method: null, status: 'ok', block_number: 1 },
      WALLET,
    );
    expect(item?.direction).toBe('in');
    expect(item?.counterpartyIsContract).toBe(false);
    const pending = normaliseTransaction(
      { hash: '0x2', from: { hash: OTHER }, to: { hash: WALLET }, value: '1', timestamp: null, method: null, status: null, block_number: null },
      WALLET,
    );
    expect(pending).toBeNull();
  });

  it('treats contract creation as a contract interaction', () => {
    const item = normaliseTransaction(
      {
        hash: '0x3',
        from: { hash: WALLET },
        to: null,
        created_contract: { hash: OTHER },
        value: '0',
        timestamp: '2026-09-29T10:00:00Z',
        method: null,
        status: 'ok',
        block_number: 1,
      },
      WALLET,
    );
    expect(item).toMatchObject({ direction: 'out', counterparty: OTHER, counterpartyIsContract: true, method: 'contract creation' });
  });
});

describe('normaliseTokenTransfer', () => {
  it('builds a token movement with a unique id per log', () => {
    const item = normaliseTokenTransfer(
      {
        transaction_hash: '0xAA',
        log_index: 3,
        from: { hash: OTHER, is_contract: true },
        to: { hash: WALLET },
        timestamp: '2026-09-29T10:00:00Z',
        block_number: 2,
        method: '0xa9059cbb',
        token: { symbol: 'USDC', name: 'USD Coin', decimals: '6', type: 'ERC-20' },
        total: { value: '1000000', decimals: '6' },
      },
      WALLET,
    );
    expect(item).toMatchObject({
      id: '0xaa:3',
      kind: 'token-transfer',
      direction: 'in',
      counterpartyIsContract: true,
      method: null,
      token: { symbol: 'USDC', amount: '1000000', decimals: 6, standard: 'ERC-20' },
    });
  });
});

describe('fetchActivity', () => {
  it('rejects malformed input without touching the network', async () => {
    const fetchImpl = vi.fn();
    await expect(fetchActivity('hello', { fetchImpl })).rejects.toMatchObject({ code: 'invalid-input' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('follows pagination up to the page limit and merges both feeds', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith(`/addresses/${WALLET}`)) return jsonResponse({ hash: WALLET, is_contract: false, ens_domain_name: 'me.eth' });
      if (url.includes('/transactions')) {
        const page = url.includes('block_number=5') ? 2 : 1;
        return jsonResponse({
          items: [
            {
              hash: `0xtx${page}`,
              from: { hash: WALLET },
              to: { hash: OTHER },
              value: '1',
              timestamp: '2026-09-29T10:00:00Z',
              method: null,
              status: 'ok',
              block_number: page,
            },
          ],
          next_page_params: page === 1 ? { block_number: 5, index: 0 } : null,
        });
      }
      if (url.includes('/token-transfers')) {
        return jsonResponse({
          items: [
            {
              transaction_hash: '0xtt',
              log_index: 1,
              from: { hash: OTHER },
              to: { hash: WALLET },
              timestamp: '2026-09-28T10:00:00Z',
              block_number: 1,
              token: { symbol: 'T', name: 'Token', decimals: '18', type: 'ERC-20' },
              total: { value: '1', decimals: '18' },
            },
          ],
          next_page_params: null,
        });
      }
      return jsonResponse({}, 404);
    });

    const result = await fetchActivity(WALLET, { fetchImpl, maxTransactionPages: 2 });
    expect(result.wallet.ensName).toBe('me.eth');
    expect(result.interactions.map((i) => i.id)).toEqual(['0xtx1', '0xtx2', '0xtt:1']);
    expect(result.source).toMatchObject({ transactionPages: 2, tokenTransferPages: 1, truncated: false });
    expect(calls.some((url) => url.includes('block_number=5'))).toBe(true);
  });

  it('resolves ENS names through the search endpoint', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/search')) {
        return jsonResponse({ items: [{ address_hash: OTHER, ens_info: { name: 'Friend.eth' } }] });
      }
      if (url.endsWith(`/addresses/${OTHER}`)) return jsonResponse({ hash: OTHER });
      return jsonResponse({ items: [], next_page_params: null });
    });
    const result = await fetchActivity('friend.eth', { fetchImpl });
    expect(result.wallet.address).toBe(OTHER);
    expect(result.wallet.ensName).toBe('friend.eth');
  });

  it('reports a missing ENS record clearly', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ items: [] }));
    await expect(fetchActivity('nobody.eth', { fetchImpl })).rejects.toMatchObject({ code: 'ens-not-found' });
  });

  it('maps HTTP 429 to a rate-limit error and network failures to a retryable error', async () => {
    await expect(fetchActivity(WALLET, { fetchImpl: vi.fn(async () => jsonResponse({}, 429)) })).rejects.toMatchObject({
      code: 'rate-limited',
    });
    const failing = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const error = await fetchActivity(WALLET, { fetchImpl: failing }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ActivityError);
    expect((error as ActivityError).code).toBe('network');
  });

  it('surfaces cancellation as an aborted error', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      controller.abort();
      if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return jsonResponse({});
    });
    await expect(fetchActivity(WALLET, { fetchImpl, signal: controller.signal })).rejects.toMatchObject({ code: 'aborted' });
  });
});
