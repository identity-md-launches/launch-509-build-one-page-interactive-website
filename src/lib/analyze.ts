import { dayKey } from './format';
import type { Filters, Interaction } from './types';

export interface GraphNode {
  /** Lower-cased address. */
  id: string;
  display: string;
  label: string | null;
  isContract: boolean;
  /** All interactions with this counterparty (after filtering). */
  total: number;
  outgoing: number;
  incoming: number;
  contractCalls: number;
  tokenTransfers: number;
  firstSeen: number;
  lastSeen: number;
  tokens: string[];
}

export interface GraphEdge {
  id: string;
  target: string;
  direction: 'in' | 'out';
  isContract: boolean;
  count: number;
  valueWei: string;
  tokenTransfers: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Stats {
  transactions: number;
  interactions: number;
  uniqueCounterparties: number;
  contractInteractions: number;
  mostActiveDay: { day: string; count: number } | null;
  earliest: number | null;
  latest: number | null;
}

export function isContractInteraction(item: Interaction): boolean {
  return item.counterpartyIsContract;
}

/**
 * Keep an interaction when its direction is enabled and, if it involves a
 * contract, the contract toggle is enabled too. Self transfers follow the
 * outgoing toggle.
 */
export function applyFilters(items: Interaction[], filters: Filters): Interaction[] {
  return items.filter((item) => {
    const directionOn =
      item.direction === 'in' ? filters.incoming : filters.outgoing;
    if (!directionOn) return false;
    if (isContractInteraction(item) && !filters.contracts) return false;
    return true;
  });
}

export function buildGraph(items: Interaction[]): Graph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const item of items) {
    if (!item.counterparty || item.direction === 'self') continue;
    const id = item.counterparty;
    let node = nodes.get(id);
    if (!node) {
      node = {
        id,
        display: item.counterpartyDisplay ?? id,
        label: item.counterpartyLabel,
        isContract: item.counterpartyIsContract,
        total: 0,
        outgoing: 0,
        incoming: 0,
        contractCalls: 0,
        tokenTransfers: 0,
        firstSeen: item.timestamp,
        lastSeen: item.timestamp,
        tokens: [],
      };
      nodes.set(id, node);
    }
    node.total += 1;
    if (item.direction === 'out') node.outgoing += 1;
    else node.incoming += 1;
    if (isContractInteraction(item)) node.contractCalls += 1;
    if (item.kind === 'token-transfer') node.tokenTransfers += 1;
    if (item.counterpartyIsContract) node.isContract = true;
    if (!node.label && item.counterpartyLabel) node.label = item.counterpartyLabel;
    node.firstSeen = Math.min(node.firstSeen, item.timestamp);
    node.lastSeen = Math.max(node.lastSeen, item.timestamp);
    if (item.token && !node.tokens.includes(item.token.symbol)) node.tokens.push(item.token.symbol);

    const edgeId = `${id}:${item.direction}`;
    let edge = edges.get(edgeId);
    if (!edge) {
      edge = {
        id: edgeId,
        target: id,
        direction: item.direction,
        isContract: false,
        count: 0,
        valueWei: '0',
        tokenTransfers: 0,
      };
      edges.set(edgeId, edge);
    }
    edge.count += 1;
    edge.isContract = edge.isContract || isContractInteraction(item);
    if (item.kind === 'token-transfer') edge.tokenTransfers += 1;
    edge.valueWei = addWei(edge.valueWei, item.valueWei);
  }

  const nodeList = [...nodes.values()].sort(
    (a, b) => b.total - a.total || b.lastSeen - a.lastSeen || a.id.localeCompare(b.id),
  );
  const edgeList = [...edges.values()].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  return { nodes: nodeList, edges: edgeList };
}

export function computeStats(items: Interaction[]): Stats {
  const txHashes = new Set<string>();
  const counterparties = new Set<string>();
  const days = new Map<string, number>();
  let contractInteractions = 0;
  let earliest: number | null = null;
  let latest: number | null = null;

  for (const item of items) {
    txHashes.add(item.txHash);
    if (item.counterparty && item.direction !== 'self') counterparties.add(item.counterparty);
    if (isContractInteraction(item)) contractInteractions += 1;
    const key = dayKey(item.timestamp);
    days.set(key, (days.get(key) ?? 0) + 1);
    earliest = earliest === null ? item.timestamp : Math.min(earliest, item.timestamp);
    latest = latest === null ? item.timestamp : Math.max(latest, item.timestamp);
  }

  let mostActiveDay: Stats['mostActiveDay'] = null;
  for (const [day, count] of days) {
    if (!mostActiveDay || count > mostActiveDay.count || (count === mostActiveDay.count && day > mostActiveDay.day)) {
      mostActiveDay = { day, count };
    }
  }

  return {
    transactions: txHashes.size,
    interactions: items.length,
    uniqueCounterparties: counterparties.size,
    contractInteractions,
    mostActiveDay,
    earliest,
    latest,
  };
}

export function countByCategory(items: Interaction[]): { outgoing: number; incoming: number; contracts: number } {
  let outgoing = 0;
  let incoming = 0;
  let contracts = 0;
  for (const item of items) {
    if (item.direction === 'in') incoming += 1;
    else outgoing += 1;
    if (isContractInteraction(item)) contracts += 1;
  }
  return { outgoing, incoming, contracts };
}

function addWei(a: string, b: string): string {
  try {
    return (BigInt(a || '0') + BigInt(b || '0')).toString();
  } catch {
    return a;
  }
}
