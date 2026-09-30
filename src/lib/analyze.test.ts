import { describe, expect, it } from 'vitest';
import { applyFilters, buildGraph, computeStats, countByCategory } from './analyze';
import { DEFAULT_FILTERS, type Interaction } from './types';

const WALLET = '0x1111111111111111111111111111111111111111';
const ALICE = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ROUTER = '0xcccccccccccccccccccccccccccccccccccccccc';

function make(partial: Partial<Interaction> & { id: string }): Interaction {
  return {
    txHash: partial.id.split(':')[0]!,
    kind: 'transaction',
    direction: 'out',
    counterparty: ALICE,
    counterpartyDisplay: ALICE,
    counterpartyIsContract: false,
    counterpartyLabel: null,
    timestamp: Date.UTC(2026, 8, 28, 12),
    valueWei: '1000000000000000000',
    method: null,
    status: 'ok',
    blockNumber: 1,
    token: null,
    ...partial,
  };
}

const ITEMS: Interaction[] = [
  make({ id: '0x1', direction: 'out', counterparty: ALICE, counterpartyDisplay: ALICE }),
  make({ id: '0x2', direction: 'in', counterparty: ALICE, counterpartyDisplay: ALICE, timestamp: Date.UTC(2026, 8, 29, 1) }),
  make({
    id: '0x3',
    direction: 'out',
    counterparty: ROUTER,
    counterpartyDisplay: ROUTER,
    counterpartyIsContract: true,
    counterpartyLabel: 'Uniswap router',
    method: 'execute',
    valueWei: '0',
    timestamp: Date.UTC(2026, 8, 29, 2),
  }),
  make({
    id: '0x3:7',
    kind: 'token-transfer',
    direction: 'in',
    counterparty: ROUTER,
    counterpartyDisplay: ROUTER,
    counterpartyIsContract: true,
    valueWei: '0',
    token: { symbol: 'USDC', name: 'USD Coin', amount: '5000000', decimals: 6, standard: 'ERC-20' },
    timestamp: Date.UTC(2026, 8, 29, 2),
  }),
  make({ id: '0x4', direction: 'self', counterparty: WALLET, counterpartyDisplay: WALLET, timestamp: Date.UTC(2026, 8, 27) }),
];

describe('applyFilters', () => {
  it('keeps everything with the default filters', () => {
    expect(applyFilters(ITEMS, DEFAULT_FILTERS)).toHaveLength(5);
  });

  it('drops outgoing and self interactions when outgoing is off', () => {
    const kept = applyFilters(ITEMS, { ...DEFAULT_FILTERS, outgoing: false });
    expect(kept.map((i) => i.id)).toEqual(['0x2', '0x3:7']);
  });

  it('drops incoming interactions when incoming is off', () => {
    const kept = applyFilters(ITEMS, { ...DEFAULT_FILTERS, incoming: false });
    expect(kept.map((i) => i.id)).toEqual(['0x1', '0x3', '0x4']);
  });

  it('drops every contract interaction when contracts are off', () => {
    const kept = applyFilters(ITEMS, { ...DEFAULT_FILTERS, contracts: false });
    expect(kept.map((i) => i.id)).toEqual(['0x1', '0x2', '0x4']);
  });

  it('returns nothing when every filter is off', () => {
    expect(applyFilters(ITEMS, { outgoing: false, incoming: false, contracts: false })).toEqual([]);
  });
});

describe('buildGraph', () => {
  it('aggregates one node per counterparty, busiest first, and skips self transfers', () => {
    const graph = buildGraph(ITEMS);
    // Equal totals: the more recently seen counterparty comes first.
    expect(graph.nodes.map((n) => n.id)).toEqual([ROUTER, ALICE]);
    const alice = graph.nodes[1]!;
    expect(alice).toMatchObject({ total: 2, outgoing: 1, incoming: 1, contractCalls: 0, isContract: false });
    const router = graph.nodes[0]!;
    expect(router).toMatchObject({
      total: 2,
      outgoing: 1,
      incoming: 1,
      contractCalls: 2,
      tokenTransfers: 1,
      isContract: true,
      label: 'Uniswap router',
      tokens: ['USDC'],
    });
    expect(router.firstSeen).toBe(Date.UTC(2026, 8, 29, 2));
  });

  it('creates one edge per counterparty and direction with summed value', () => {
    const graph = buildGraph(ITEMS);
    const ids = graph.edges.map((e) => e.id).sort();
    expect(ids).toEqual([`${ALICE}:in`, `${ALICE}:out`, `${ROUTER}:in`, `${ROUTER}:out`].sort());
    const aliceOut = graph.edges.find((e) => e.id === `${ALICE}:out`)!;
    expect(aliceOut.valueWei).toBe('1000000000000000000');
    expect(aliceOut.isContract).toBe(false);
    const routerOut = graph.edges.find((e) => e.id === `${ROUTER}:out`)!;
    expect(routerOut.isContract).toBe(true);
  });

  it('handles an empty list', () => {
    expect(buildGraph([])).toEqual({ nodes: [], edges: [] });
  });
});

describe('computeStats', () => {
  it('counts unique transactions, counterparties, contract interactions and the busiest day', () => {
    const stats = computeStats(ITEMS);
    expect(stats.transactions).toBe(4); // 0x3 and 0x3:7 share a hash
    expect(stats.interactions).toBe(5);
    expect(stats.uniqueCounterparties).toBe(2); // self transfer is not a counterparty
    expect(stats.contractInteractions).toBe(2);
    expect(stats.mostActiveDay).toEqual({ day: '2026-09-29', count: 3 });
    expect(stats.earliest).toBe(Date.UTC(2026, 8, 27));
    expect(stats.latest).toBe(Date.UTC(2026, 8, 29, 2));
  });

  it('returns nulls for an empty list', () => {
    expect(computeStats([])).toEqual({
      transactions: 0,
      interactions: 0,
      uniqueCounterparties: 0,
      contractInteractions: 0,
      mostActiveDay: null,
      earliest: null,
      latest: null,
    });
  });
});

describe('countByCategory', () => {
  it('reports the per-filter totals shown on the chips', () => {
    expect(countByCategory(ITEMS)).toEqual({ outgoing: 3, incoming: 2, contracts: 2 });
  });
});
