import { describe, expect, it } from 'vitest';
import { dayKey, formatDayKey, formatEth, formatTokenAmount, formatUnits, isAddress, isEnsName, shortAddress } from './format';

describe('address validation', () => {
  it('accepts 40 hex characters after 0x', () => {
    expect(isAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(true);
    expect(isAddress('  0xd8da6bf26964af9d7eed9e03e53415d37aa96045 ')).toBe(true);
  });

  it('rejects malformed addresses', () => {
    expect(isAddress('0x123')).toBe(false);
    expect(isAddress('d8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
    expect(isAddress('0xZZdA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe(false);
  });

  it('recognises ENS names', () => {
    expect(isEnsName('vitalik.eth')).toBe(true);
    expect(isEnsName('sub.name.eth')).toBe(true);
    expect(isEnsName('vitalik')).toBe(false);
    expect(isEnsName('vitalik.com')).toBe(false);
  });
});

describe('shortAddress', () => {
  it('keeps the head and tail', () => {
    expect(shortAddress('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBe('0xd8dA…6045');
  });
});

describe('unit formatting', () => {
  it('formats whole and fractional ETH', () => {
    expect(formatEth('1000000000000000000')).toBe('1 ETH');
    expect(formatEth('1500000000000000000')).toBe('1.5 ETH');
    expect(formatEth('123456789000000000000')).toBe('123.4567 ETH');
    expect(formatEth('0')).toBe('0 ETH');
    expect(formatEth('1')).toBe('<0.0001 ETH');
  });

  it('formats token amounts with their decimals', () => {
    expect(formatTokenAmount('5000000', 6, 'USDC')).toBe('5 USDC');
    expect(formatTokenAmount('12345678901234567890123', 18, 'DAI')).toBe('12,345.6789 DAI');
  });

  it('groups thousands', () => {
    expect(formatUnits(1234567n, 0)).toBe('1,234,567');
  });

  it('survives garbage input', () => {
    expect(formatEth('not-a-number')).toBe('0 ETH');
  });
});

describe('day keys', () => {
  it('uses UTC dates', () => {
    const ms = Date.UTC(2026, 8, 29, 23, 59);
    expect(dayKey(ms)).toBe('2026-09-29');
    expect(formatDayKey('2026-09-29')).toBe('Sep 29, 2026');
  });
});
