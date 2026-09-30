const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ENS_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i;

export function isAddress(value: string): boolean {
  return ADDRESS_RE.test(value.trim());
}

export function isEnsName(value: string): boolean {
  return ENS_RE.test(value.trim());
}

export function shortAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** Format a wei string as ETH with a sensible number of digits. */
export function formatEth(wei: string): string {
  let value: bigint;
  try {
    value = BigInt(wei || '0');
  } catch {
    return '0 ETH';
  }
  return `${formatUnits(value, 18)} ETH`;
}

export function formatTokenAmount(raw: string, decimals: number, symbol: string): string {
  let value: bigint;
  try {
    value = BigInt(raw || '0');
  } catch {
    return symbol;
  }
  return `${formatUnits(value, decimals)} ${symbol}`;
}

/** BigInt-safe unit formatting, trimmed to at most 4 significant fraction digits. */
export function formatUnits(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const fraction = abs % base;
  if (fraction === 0n) return `${negative ? '-' : ''}${groupThousands(whole.toString())}`;
  // Keep at most 4 fraction digits; anything smaller reads as "<0.0001".
  const fractionText = fraction.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '');
  if (whole === 0n && fractionText === '') return `${negative ? '-' : ''}<0.0001`;
  return `${negative ? '-' : ''}${groupThousands(whole.toString())}${fractionText ? `.${fractionText}` : ''}`;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

const DATE_TIME = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

const DATE_ONLY = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function formatDateTime(ms: number): string {
  return `${DATE_TIME.format(new Date(ms))} UTC`;
}

export function formatDate(ms: number): string {
  return DATE_ONLY.format(new Date(ms));
}

/** YYYY-MM-DD key in UTC. */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function formatDayKey(key: string): string {
  const ms = Date.parse(`${key}T00:00:00Z`);
  return Number.isNaN(ms) ? key : DATE_ONLY.format(new Date(ms));
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatCount(n)} ${n === 1 ? singular : plural}`;
}
